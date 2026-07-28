import http, { IncomingMessage, ServerResponse } from 'http';
import { ALLOWED_CONTAINERS, HOST, MANAGER_TOKEN, PORT } from './config';
import { isAuthorized } from './auth';
import { isAllowedReadPath, proxyDockerGet } from './readProxy';
import { ConflictError, ForbiddenError, getStatus, startUpdate } from './updateManager';
import { DockerError } from './dockerClient';

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleUpdate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { container?: string; requestId?: string };
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const container = typeof body.container === 'string' ? body.container.trim() : '';
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  if (!container || !requestId) {
    sendJson(res, 400, { error: 'Fields "container" and "requestId" are required' });
    return;
  }

  try {
    const status = await startUpdate(container, requestId);
    sendJson(res, 202, status);
  } catch (err) {
    if (err instanceof ConflictError) {
      sendJson(res, 409, { error: err.message });
    } else if (err instanceof ForbiddenError) {
      sendJson(res, 403, { error: err.message });
    } else if (err instanceof DockerError) {
      sendJson(res, err.statusCode === 404 ? 404 : 500, { error: err.message });
    } else {
      sendJson(res, 500, { error: (err as Error).message });
    }
  }
}

function createServer(): http.Server {
  return http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || '/';
    const pathname = new URL(url, 'http://localhost').pathname;

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { status: 'ok', ts: Date.now() });
      return;
    }

    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET' && isAllowedReadPath(pathname)) {
      proxyDockerGet(req, res, url);
      return;
    }

    if (req.method === 'POST' && pathname === '/update') {
      void handleUpdate(req, res);
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/status/')) {
      const requestId = decodeURIComponent(pathname.slice('/status/'.length));
      const status = getStatus(requestId);
      if (!status) {
        sendJson(res, 404, { error: `Unknown request id: ${requestId}` });
        return;
      }
      sendJson(res, 200, status);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });
}

if (require.main === module) {
  if (!MANAGER_TOKEN) {
    console.error('MANAGER_TOKEN env variable is required — refusing to start without authentication');
    process.exit(1);
  }
  if (ALLOWED_CONTAINERS.length === 0) {
    console.warn('ALLOWED_CONTAINERS is empty — updates are disabled, only read proxying will work');
  }
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(new Date().toISOString(), `container-manager listening on ${HOST}:${PORT}`);
    console.log(new Date().toISOString(), `Allowed containers for update: ${ALLOWED_CONTAINERS.join(', ') || '(none)'}`);
  });
}

export default createServer;
