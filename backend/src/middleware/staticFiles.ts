import fs from 'fs';
import path from 'path';
import { ServerResponse } from 'http';

const contentTypes: { [key: string]: string } = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function serveFile(
  res: ServerResponse,
  filePath: string,
  statusCode: number = 200,
  customContentType?: string
): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = customContentType || contentTypes[ext] || 'application/octet-stream';
  const finalContentType = ext === '.html' ? `${contentType}; charset=utf-8` : contentType;
  res.writeHead(statusCode, { 'Content-Type': finalContentType });
  fs.createReadStream(filePath).pipe(res);
  return true;
}


