import { IncomingMessage, ServerResponse } from 'http';
import { serveFile } from '../middleware/staticFiles';
import { PUBLIC_DIR } from '../config';
import path from 'path';

export function handleNotFound(res: ServerResponse): boolean {
  const notFoundPath = path.join(PUBLIC_DIR, '/404.html');
  if (serveFile(res, notFoundPath, 404)) {
    return true;
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return true;
  }
}

export function handlePageRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): boolean {
  if (req.method === 'GET' && pathname === '/unauthorized') {
    const filePath = path.join(PUBLIC_DIR, '/unauthorized.html');
    if (!serveFile(res, filePath, 401)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/') {
    const filePath = path.join(PUBLIC_DIR, '/index.html');
    if (serveFile(res, filePath)) {
      return true;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return true;
    }
  }

  return false;
}


