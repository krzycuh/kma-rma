import { IncomingMessage, ServerResponse } from 'http';
import { SuccessObject } from '../utils/ControllerResult';

export async function handleApiRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  user: string
): Promise<boolean> {
  if (req.method === 'GET' && pathname === '/api/user') {
    const result = new SuccessObject({ name: user });
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  return false;
}


