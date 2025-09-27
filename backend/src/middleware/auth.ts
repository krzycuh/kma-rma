import { VALID_TOKENS } from '../config';

export function validateToken(token: string | null): string | null {
  if (!token || !VALID_TOKENS[token]) {
    return null;
  }
  return VALID_TOKENS[token];
}


