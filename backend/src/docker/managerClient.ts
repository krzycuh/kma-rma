import { randomUUID } from 'crypto';
import { dockerJsonRequest, isManagerConfigured } from './client';

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

export { isManagerConfigured };

/**
 * Asks the container-manager service to update a container (any container,
 * including the one hosting this backend — the manager lives outside it).
 */
export async function requestContainerUpdate(containerIdOrName: string): Promise<UpdateStatus> {
  const requestId = randomUUID();
  return dockerJsonRequest<UpdateStatus>({
    path: '/update',
    method: 'POST',
    body: { container: containerIdOrName, requestId },
    allowStatusCodes: [202]
  });
}

export async function getUpdateStatus(requestId: string): Promise<UpdateStatus> {
  return dockerJsonRequest<UpdateStatus>({
    path: `/status/${encodeURIComponent(requestId)}`,
    method: 'GET'
  });
}
