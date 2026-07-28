import http, { IncomingMessage, ServerResponse } from 'http';
import { DOCKER_SOCK_PATH } from './config';

// The only Docker API paths the dashboard may read. Everything else — in
// particular every mutating endpoint — is rejected; updates go exclusively
// through the dedicated /update flow.
const ALLOWED_READ_PATHS: RegExp[] = [
  /^\/containers\/json$/,
  /^\/containers\/[A-Za-z0-9_.-]+\/json$/,
  /^\/containers\/[A-Za-z0-9_.-]+\/stats$/,
  /^\/containers\/[A-Za-z0-9_.-]+\/logs$/
];

const agent = new http.Agent({ keepAlive: true, maxSockets: 25 });

export function isAllowedReadPath(pathname: string): boolean {
  return ALLOWED_READ_PATHS.some(pattern => pattern.test(pathname));
}

/**
 * Streams a GET request through to the Docker socket. Streaming matters for
 * `/logs?follow=1` — responses are piped, never buffered.
 */
export function proxyDockerGet(req: IncomingMessage, res: ServerResponse, url: string): void {
  const upstream = http.request(
    {
      socketPath: DOCKER_SOCK_PATH,
      path: url,
      method: 'GET',
      agent,
      headers: {
        Accept: typeof req.headers.accept === 'string' ? req.headers.accept : 'application/json'
      }
    },
    (dockerRes) => {
      const headers: Record<string, string> = {};
      if (dockerRes.headers['content-type']) {
        headers['Content-Type'] = dockerRes.headers['content-type'];
      }
      res.writeHead(dockerRes.statusCode ?? 502, headers);
      dockerRes.pipe(res);
    }
  );

  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: `Docker API request failed: ${err.message}` }));
  });

  res.on('close', () => {
    upstream.destroy();
  });

  upstream.end();
}
