import { dockerJsonRequest, dockerRequest, DockerError } from './dockerClient';
import {
  DockerConfig,
  DockerContainerCreateResponse,
  DockerContainerInspect,
  DockerHostConfig,
  DockerNetworkEndpoint,
  DockerNetworkSettings
} from './dockerTypes';
import {
  ALLOWED_CONTAINERS,
  PRE_STOP_DELAY_MS,
  VERIFY_STABLE_MS,
  VERIFY_TIMEOUT_MS
} from './config';

export type UpdateState =
  | 'pulling'
  | 'up-to-date'
  | 'restarting'
  | 'verifying'
  | 'done'
  | 'rolled-back'
  | 'failed';

export type UpdateStatus = {
  requestId: string;
  container: string;
  state: UpdateState;
  message: string;
  logs: string[];
  startedAt: number;
  finishedAt?: number;
};

export class ConflictError extends Error {}
export class ForbiddenError extends Error {}

const TERMINAL_STATES: UpdateState[] = ['up-to-date', 'done', 'rolled-back', 'failed'];
const MAX_STATUSES = 50;

const statuses = new Map<string, UpdateStatus>();
let activeRequestId: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pruneStatuses(): void {
  while (statuses.size > MAX_STATUSES) {
    const oldest = statuses.keys().next().value;
    if (!oldest) break;
    statuses.delete(oldest);
  }
}

export function getStatus(requestId: string): UpdateStatus | undefined {
  return statuses.get(requestId);
}

export function isUpdateInProgress(): boolean {
  return activeRequestId !== null;
}

type ImageInspect = {
  Id: string;
  RepoTags?: string[];
  RepoDigests?: string[];
  [key: string]: unknown;
};

type ImageReferenceParts = {
  reference: string;
  tag?: string;
  digest?: string;
};

function parseImageReference(image: string): ImageReferenceParts {
  const digestIndex = image.indexOf('@');
  if (digestIndex >= 0) {
    return {
      reference: image.slice(0, digestIndex),
      digest: image.slice(digestIndex + 1)
    };
  }

  const lastSlash = image.lastIndexOf('/');
  const lastColon = image.lastIndexOf(':');
  if (lastColon > lastSlash) {
    return {
      reference: image.slice(0, lastColon),
      tag: image.slice(lastColon + 1)
    };
  }

  return { reference: image, tag: 'latest' };
}

function sanitizeConfig(config?: DockerConfig): DockerConfig {
  if (!config) return {};
  const result: DockerConfig = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) continue;
    result[key] = value;
  }
  return result;
}

function sanitizeHostConfig(hostConfig?: DockerHostConfig): DockerHostConfig | undefined {
  if (!hostConfig) return undefined;
  const result: DockerHostConfig = {};
  for (const [key, value] of Object.entries(hostConfig)) {
    if (value === null || value === undefined) continue;
    result[key] = value;
  }
  return result;
}

function buildEndpointEntry(endpoint: DockerNetworkEndpoint): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  if (endpoint.Aliases && endpoint.Aliases.length > 0) {
    entry.Aliases = endpoint.Aliases;
  }
  if (endpoint.DriverOpts && Object.keys(endpoint.DriverOpts).length > 0) {
    entry.DriverOpts = endpoint.DriverOpts;
  }
  if (endpoint.IPAMConfig && Object.keys(endpoint.IPAMConfig).length > 0) {
    entry.IPAMConfig = endpoint.IPAMConfig;
  }
  if (endpoint.Links && endpoint.Links.length > 0) {
    entry.Links = endpoint.Links;
  }
  return entry;
}

function collectNetworkEndpoints(settings?: DockerNetworkSettings): Array<[string, Record<string, unknown>]> {
  if (!settings?.Networks) return [];
  const endpoints: Array<[string, Record<string, unknown>]> = [];
  for (const [name, endpoint] of Object.entries(settings.Networks)) {
    if (!endpoint) continue;
    endpoints.push([name, buildEndpointEntry(endpoint)]);
  }
  return endpoints;
}

async function inspectContainer(idOrName: string): Promise<DockerContainerInspect> {
  return dockerJsonRequest<DockerContainerInspect>({
    path: `/containers/${encodeURIComponent(idOrName)}/json`,
    method: 'GET'
  });
}

async function inspectImage(reference: string): Promise<ImageInspect> {
  return dockerJsonRequest<ImageInspect>({
    path: `/images/${encodeURIComponent(reference)}/json`,
    method: 'GET'
  });
}

async function pullImage(image: string, log: (msg: string) => void): Promise<void> {
  const parts = parseImageReference(image);
  const params = new URLSearchParams();
  if (parts.digest) {
    params.set('fromImage', `${parts.reference}@${parts.digest}`);
  } else {
    params.set('fromImage', parts.reference);
    if (parts.tag) params.set('tag', parts.tag);
  }
  const res = await dockerRequest({
    path: `/images/create?${params.toString()}`,
    method: 'POST'
  });
  const lines = res.body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let error: string | null = null;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { status?: string; error?: string; progress?: string };
      if (parsed.error) {
        error = parsed.error;
        log(`Pull error: ${parsed.error}`);
      } else if (parsed.status && !parsed.progress) {
        log(parsed.status);
      }
    } catch {
      log(line);
    }
  }
  if (error) {
    throw new DockerError(`Image pull failed: ${error}`);
  }
}

async function stopContainer(id: string): Promise<void> {
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/stop?t=10`,
    method: 'POST',
    allowStatusCodes: [304, 404]
  });
}

async function renameContainer(id: string, newName: string): Promise<void> {
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/rename?name=${encodeURIComponent(newName)}`,
    method: 'POST'
  });
}

async function removeContainer(id: string, force = false): Promise<void> {
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}?force=${force ? 'true' : 'false'}`,
    method: 'DELETE',
    allowStatusCodes: [404]
  });
}

async function startContainer(id: string): Promise<void> {
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/start`,
    method: 'POST',
    allowStatusCodes: [304]
  });
}

async function connectNetwork(network: string, containerId: string, endpoint: Record<string, unknown>): Promise<void> {
  await dockerRequest({
    path: `/networks/${encodeURIComponent(network)}/connect`,
    method: 'POST',
    body: { Container: containerId, EndpointConfig: endpoint }
  });
}

async function createContainerFromInspect(
  inspect: DockerContainerInspect,
  name: string,
  log: (msg: string) => void
): Promise<string> {
  const config = sanitizeConfig(inspect.Config);
  config.Image = inspect.Config?.Image ?? inspect.Image ?? config.Image;
  const hostConfig = sanitizeHostConfig(inspect.HostConfig);
  const endpoints = collectNetworkEndpoints(inspect.NetworkSettings);

  const body: Record<string, unknown> = { ...config };
  if (hostConfig) {
    body.HostConfig = hostConfig;
  }
  // Only the first network can be attached at create time (older Docker
  // API versions reject multiple endpoints); the rest are connected below.
  if (endpoints.length > 0) {
    body.NetworkingConfig = { EndpointsConfig: { [endpoints[0][0]]: endpoints[0][1] } };
  }

  const created = await dockerJsonRequest<DockerContainerCreateResponse>({
    path: `/containers/create?name=${encodeURIComponent(name)}`,
    method: 'POST',
    body
  });
  if (created.Warnings) {
    created.Warnings.filter(Boolean).forEach(w => log(`Warning: ${w}`));
  }
  if (!created.Id) {
    throw new DockerError(`Docker did not return a container ID when creating ${name}`);
  }

  for (const [network, endpoint] of endpoints.slice(1)) {
    log(`Connecting network ${network}`);
    await connectNetwork(network, created.Id, endpoint);
  }

  return created.Id;
}

async function verifyContainer(id: string, log: (msg: string) => void): Promise<void> {
  const deadline = Date.now() + VERIFY_TIMEOUT_MS;
  let runningSince: number | null = null;

  for (;;) {
    const inspect = await inspectContainer(id);
    const state = inspect.State ?? {};
    const health = state.Health?.Status;

    if (health) {
      if (health === 'healthy') {
        log('Health check reports healthy');
        return;
      }
      if (health === 'unhealthy') {
        throw new DockerError('New container reports unhealthy');
      }
      // 'starting' — keep waiting until the deadline
    } else if (state.Running) {
      if (runningSince === null) {
        runningSince = Date.now();
      } else if (Date.now() - runningSince >= VERIFY_STABLE_MS) {
        log(`Container stayed running for ${VERIFY_STABLE_MS / 1000}s`);
        return;
      }
    } else {
      throw new DockerError(`New container is not running (status: ${state.Status ?? 'unknown'})`);
    }

    if (Date.now() >= deadline) {
      throw new DockerError('Verification timed out');
    }
    await sleep(1000);
  }
}

export async function startUpdate(target: string, requestId: string): Promise<UpdateStatus> {
  if (activeRequestId) {
    throw new ConflictError(`Another update is already in progress (request ${activeRequestId})`);
  }
  if (statuses.has(requestId)) {
    throw new ConflictError(`Request id ${requestId} was already used`);
  }

  const inspect = await inspectContainer(target);
  const containerName = (inspect.Name ?? '').replace(/^\//, '') || inspect.Id;

  if (!ALLOWED_CONTAINERS.includes(containerName)) {
    throw new ForbiddenError(`Container ${containerName} is not in the allowed list`);
  }

  const imageRef = inspect.Config?.Image ?? inspect.Image;
  if (!imageRef) {
    throw new DockerError(`Container ${containerName} does not have an image reference`);
  }

  const status: UpdateStatus = {
    requestId,
    container: containerName,
    state: 'pulling',
    message: `Pulling ${imageRef}…`,
    logs: [],
    startedAt: Date.now()
  };
  statuses.set(requestId, status);
  pruneStatuses();
  activeRequestId = requestId;

  void runUpdate(status, inspect, imageRef)
    .catch(err => {
      // runUpdate handles its own errors; this only guards against bugs
      finish(status, 'failed', `Unexpected updater error: ${(err as Error).message}`);
    })
    .finally(() => {
      activeRequestId = null;
    });

  return status;
}

function log(status: UpdateStatus, message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  status.logs.push(line);
  if (status.logs.length > 200) {
    status.logs.splice(0, status.logs.length - 200);
  }
  console.log(`[update ${status.requestId}] ${message}`);
}

function transition(status: UpdateStatus, state: UpdateState, message: string): void {
  status.state = state;
  status.message = message;
  log(status, message);
}

function finish(status: UpdateStatus, state: UpdateState, message: string): void {
  transition(status, state, message);
  status.finishedAt = Date.now();
}

async function runUpdate(status: UpdateStatus, inspect: DockerContainerInspect, imageRef: string): Promise<void> {
  const containerName = status.container;
  const logFn = (msg: string) => log(status, msg);

  // 1. Pull
  const oldImageId = inspect.Image ?? null;
  try {
    await pullImage(imageRef, logFn);
  } catch (err) {
    finish(status, 'failed', `Pull failed: ${(err as Error).message}`);
    return;
  }

  // 2. Compare image IDs
  let newImageId: string | null = null;
  try {
    newImageId = (await inspectImage(imageRef)).Id ?? null;
  } catch (err) {
    finish(status, 'failed', `Failed to inspect image after pull: ${(err as Error).message}`);
    return;
  }
  if (oldImageId && newImageId && newImageId === oldImageId) {
    finish(status, 'up-to-date', 'Image already up to date; no restart required.');
    return;
  }

  // 3. Recreate
  transition(status, 'restarting', `Restarting ${containerName} with the new image…`);
  await sleep(PRE_STOP_DELAY_MS);

  const temporaryName = `${containerName}-old-${Date.now()}`;
  let renamed = false;
  let newContainerId: string | null = null;

  try {
    logFn(`Stopping ${containerName}`);
    await stopContainer(inspect.Id);
    logFn(`Renaming old container to ${temporaryName}`);
    await renameContainer(inspect.Id, temporaryName);
    renamed = true;

    logFn(`Creating new container ${containerName}`);
    newContainerId = await createContainerFromInspect(inspect, containerName, logFn);
    logFn(`Starting new container ${newContainerId.substring(0, 12)}`);
    await startContainer(newContainerId);

    // 4. Verify
    transition(status, 'verifying', 'Verifying new container…');
    await verifyContainer(newContainerId, logFn);

    // 5. Cleanup
    logFn('Removing old container');
    await removeContainer(inspect.Id, true);
    finish(status, 'done', 'Container updated and verified.');
  } catch (err) {
    logFn(`ERROR: ${(err as Error).message}`);
    // Rollback
    try {
      if (newContainerId) {
        logFn('Removing failed new container');
        await removeContainer(newContainerId, true);
      }
      if (renamed) {
        logFn(`Restoring old container name ${containerName}`);
        await renameContainer(inspect.Id, containerName);
      }
      logFn('Starting old container');
      await startContainer(inspect.Id);
      finish(status, 'rolled-back', `Update failed, rolled back to previous version: ${(err as Error).message}`);
    } catch (rollbackErr) {
      logFn(`CRITICAL: rollback failed: ${(rollbackErr as Error).message}`);
      finish(
        status,
        'failed',
        `Update failed and rollback failed; old container may be stopped under name ${renamed ? temporaryName : containerName}. Manual intervention required.`
      );
    }
  }
}

export { TERMINAL_STATES };
