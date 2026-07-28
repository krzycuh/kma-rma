import { IncomingMessage } from 'http';
import { createHash, timingSafeEqual } from 'crypto';
import { MANAGER_TOKEN } from './config';

export const MANAGER_TOKEN_HEADER = 'x-manager-token';

export function isAuthorized(req: IncomingMessage): boolean {
  if (!MANAGER_TOKEN) return false;
  const provided = req.headers[MANAGER_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(MANAGER_TOKEN).digest();
  return timingSafeEqual(providedHash, expectedHash);
}
