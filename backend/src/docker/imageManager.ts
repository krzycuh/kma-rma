import { dockerJsonRequest, dockerRequest, DockerError } from './client';
import {
  DockerContainerCreateResponse,
  DockerContainerInspect,
  DockerConfig,
  DockerHostConfig,
  DockerNetworkSettings
} from './types';

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
  original: string;
};

export type ContainerUpdateResult = {
  containerId: string;
  containerName: string;
  image: string;
  oldImageId: string | null;
  newImageId: string | null;
  pulled: boolean;
  imageUpdated: boolean;
  recreated: boolean;
  newContainerId?: string;
  message: string;
  logs: string[];
};

function parseImageReference(image: string): ImageReferenceParts {
  const original = image;
  const digestIndex = image.indexOf('@');
  if (digestIndex >= 0) {
    return {
      reference: image.slice(0, digestIndex),
      digest: image.slice(digestIndex + 1),
      original
    };
  }

  const lastSlash = image.lastIndexOf('/');
  const lastColon = image.lastIndexOf(':');
  if (lastColon > lastSlash) {
    return {
      reference: image.slice(0, lastColon),
      tag: image.slice(lastColon + 1),
      original
    };
  }

  return {
    reference: image,
    tag: 'latest',
    original
  };
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

function buildNetworkingConfig(settings?: DockerNetworkSettings) {
  if (!settings?.Networks) return undefined;
  const endpoints: Record<string, Record<string, unknown>> = {};
  for (const [name, endpoint] of Object.entries(settings.Networks)) {
    const entry: Record<string, unknown> = {};
    if (!endpoint) continue;
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
    endpoints[name] = entry;
  }
  if (Object.keys(endpoints).length === 0) return undefined;
  return { EndpointsConfig: endpoints };
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

async function pullImage(image: string): Promise<string[]> {
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
  const logs: string[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { status?: string; error?: string; progress?: string };
      if (parsed.error) {
        logs.push(parsed.error);
      } else if (parsed.status) {
        logs.push(parsed.progress ? `${parsed.status} ${parsed.progress}` : parsed.status);
      }
    } catch {
      logs.push(line);
    }
  }
  return logs;
}

async function stopContainer(id: string): Promise<void> {
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/stop?t=10`,
    method: 'POST',
    allowStatusCodes: [304, 404]
  }).catch((err) => {
    if (err instanceof DockerError && err.statusCode === 304) {
      return;
    }
    throw err;
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

async function createContainerFromInspect(
  inspect: DockerContainerInspect,
  name: string
): Promise<DockerContainerCreateResponse> {
  const config = sanitizeConfig(inspect.Config);
  config.Image = inspect.Config?.Image ?? inspect.Image ?? config.Image;
  const hostConfig = sanitizeHostConfig(inspect.HostConfig);
  const networkingConfig = buildNetworkingConfig(inspect.NetworkSettings);

  const body: Record<string, unknown> = {
    ...config
  };

  if (hostConfig) {
    body.HostConfig = hostConfig;
  }
  if (networkingConfig) {
    body.NetworkingConfig = networkingConfig;
  }

  return dockerJsonRequest<DockerContainerCreateResponse>({
    path: `/containers/create?name=${encodeURIComponent(name)}`,
    method: 'POST',
    body
  });
}

async function startContainer(id: string): Promise<void> {
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/start`,
    method: 'POST'
  });
}

export async function pullImageAndRecreateIfNeeded(containerIdOrName: string): Promise<ContainerUpdateResult> {
  const inspect = await inspectContainer(containerIdOrName);
  const containerName = (inspect.Name ?? '').replace(/^\//, '') || inspect.Id;
  const imageRef = inspect.Config?.Image ?? inspect.Image;
  if (!imageRef) {
    throw new DockerError(`Container ${containerIdOrName} does not have an image reference`);
  }

  const oldImageId = inspect.Image ?? null;

  const logs = await pullImage(imageRef);

  let newImageId: string | null = null;
  let imageUpdated = false;
  try {
    const imageInspect = await inspectImage(imageRef);
    newImageId = imageInspect.Id ?? null;
    if (newImageId) {
      imageUpdated = newImageId !== oldImageId;
      if (!oldImageId) {
        imageUpdated = true;
      }
    }
  } catch (err) {
    // If inspect fails after pulling, capture the error but continue to attempt restart
    logs.push(`Failed to inspect image ${imageRef} after pull: ${(err as Error).message}`);
  }

  if (!imageUpdated) {
    return {
      containerId: inspect.Id,
      containerName,
      image: imageRef,
      oldImageId,
      newImageId,
      pulled: true,
      imageUpdated: false,
      recreated: false,
      message: 'Image already up to date; no restart required.',
      logs
    };
  }

  const temporaryName = `${containerName}-old-${Date.now()}`;
  await stopContainer(inspect.Id);
  await renameContainer(inspect.Id, temporaryName);

  let newContainerId: string | undefined;
  try {
    const createResponse = await createContainerFromInspect(inspect, containerName);
    if (createResponse.Warnings) {
      logs.push(...createResponse.Warnings.filter(Boolean) as string[]);
    }
    newContainerId = createResponse.Id;
  } catch (err) {
    logs.push(`Failed to create new container for ${containerName}: ${(err as Error).message}`);
    try {
      await renameContainer(inspect.Id, containerName);
      await startContainer(inspect.Id);
    } catch (rollbackErr) {
      logs.push(`Rollback failed while restoring old container ${inspect.Id}: ${(rollbackErr as Error).message}`);
    }
    throw new DockerError(`Unable to create new container for ${containerName}: ${(err as Error).message}`);
  }

  if (!newContainerId) {
    try {
      await renameContainer(inspect.Id, containerName);
      await startContainer(inspect.Id);
    } catch (rollbackErr) {
      logs.push(`Rollback failed while restoring old container ${inspect.Id}: ${(rollbackErr as Error).message}`);
    }
    throw new DockerError(`Docker did not return a container ID when creating ${containerName}`);
  }

  let started = false;
  try {
    await startContainer(newContainerId);
    started = true;
  } catch (err) {
    logs.push(`Failed to start new container ${newContainerId}: ${(err as Error).message}`);
    // Attempt rollback
    try {
      await removeContainer(newContainerId, true).catch(() => undefined);
      await renameContainer(inspect.Id, containerName);
      await startContainer(inspect.Id);
    } catch (rollbackErr) {
      logs.push(`Rollback failed while restoring old container ${inspect.Id}: ${(rollbackErr as Error).message}`);
    }
    throw new DockerError(`Unable to start new container ${newContainerId}: ${(err as Error).message}`);
  }

  if (started) {
    // Remove the old container
    await removeContainer(inspect.Id, true).catch((err) => {
      logs.push(`Warning: Failed to remove old container ${inspect.Id}: ${(err as Error).message}`);
    });
  }

  return {
    containerId: inspect.Id,
    containerName,
    image: imageRef,
    oldImageId,
    newImageId,
    pulled: true,
    imageUpdated: true,
    recreated: true,
    newContainerId,
    message: 'Pulled latest image and recreated container with the updated version.',
    logs
  };
}

