import http from 'http';
import { DOCKER_SOCK_PATH } from '../config';

export class DockerError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'DockerError';
  }
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 25 });

export type DockerRequestOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  headers?: Record<string, string>;
  body?: string | Buffer | Record<string, unknown>;
  timeoutMs?: number;
  allowStatusCodes?: number[];
};

type DockerResponse = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

export async function dockerRequest(options: DockerRequestOptions): Promise<DockerResponse> {
  const { path, method = 'GET', headers = {}, body, timeoutMs } = options;

  return new Promise<DockerResponse>((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCK_PATH,
        path,
        method,
        headers,
        agent,
        timeout: timeoutMs
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode ?? 500;
          const allow = options.allowStatusCodes ?? [];
          if ((statusCode < 200 || statusCode >= 300) && !allow.includes(statusCode)) {
            reject(new DockerError(`Docker API ${method} ${path} failed with status ${statusCode}: ${responseBody}`, statusCode));
            return;
          }
          resolve({
            statusCode,
            headers: res.headers,
            body: responseBody
          });
        });
      }
    );

    req.on('error', (err) => reject(new DockerError(`Docker API request error for ${method} ${path}: ${err.message}`)));

    if (body != null) {
      let payload: string | Buffer;
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        payload = body;
      } else {
        const json = JSON.stringify(body);
        if (!req.hasHeader('Content-Type')) {
          req.setHeader('Content-Type', 'application/json');
        }
        payload = Buffer.from(json, 'utf8');
      }
      req.write(payload);
    }

    req.end();
  });
}

export async function dockerJsonRequest<T>(options: DockerRequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {})
  };

  let body = options.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !(typeof body === 'string')) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    body = JSON.stringify(body);
  }

  const response = await dockerRequest({
    ...options,
    headers,
    body: typeof body === 'string' ? body : body ?? undefined
  });

  try {
    return JSON.parse(response.body) as T;
  } catch (err) {
    throw new DockerError(`Failed to parse JSON from Docker response for ${options.method ?? 'GET'} ${options.path}: ${(err as Error).message}`);
  }
}

