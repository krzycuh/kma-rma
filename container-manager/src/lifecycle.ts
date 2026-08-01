import { dockerJsonRequest, dockerRequest } from './dockerClient';
import { DockerContainerInspect } from './dockerTypes';
import { isContainerAllowed } from './config';
import { ConflictError, ForbiddenError, isUpdateInProgress } from './updateManager';

export type LifecycleAction = 'stop' | 'start';

export type LifecycleResult = {
  container: string;
  action: LifecycleAction;
  state: string;
};

async function inspectContainer(idOrName: string): Promise<DockerContainerInspect> {
  return dockerJsonRequest<DockerContainerInspect>({
    path: `/containers/${encodeURIComponent(idOrName)}/json`,
    method: 'GET'
  });
}

/**
 * Stops or starts a container. A stopped container stays down (Docker does
 * not apply restart policies after an explicit stop) until it is started
 * again through this endpoint or the daemon restarts.
 */
export async function performLifecycleAction(
  target: string,
  action: LifecycleAction
): Promise<LifecycleResult> {
  if (isUpdateInProgress()) {
    throw new ConflictError('An update is in progress; try again once it finishes');
  }

  const inspect = await inspectContainer(target);
  const containerName = (inspect.Name ?? '').replace(/^\//, '') || inspect.Id;

  if (!isContainerAllowed(containerName)) {
    throw new ForbiddenError(`Container ${containerName} is not in the allowed list`);
  }

  if (action === 'stop') {
    await dockerRequest({
      path: `/containers/${encodeURIComponent(inspect.Id)}/stop?t=10`,
      method: 'POST',
      allowStatusCodes: [304]
    });
  } else {
    await dockerRequest({
      path: `/containers/${encodeURIComponent(inspect.Id)}/start`,
      method: 'POST',
      allowStatusCodes: [304]
    });
  }

  const after = await inspectContainer(inspect.Id);
  return {
    container: containerName,
    action,
    state: after.State?.Status ?? 'unknown'
  };
}
