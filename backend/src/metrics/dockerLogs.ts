import http, { ServerResponse } from 'http';
import { DOCKER_SOCK_PATH } from '../config';

const agent = new http.Agent({ keepAlive: true });

function writeSse(res: ServerResponse, data: string): void {
  res.write(`data: ${data}\n\n`);
}

function writeEvent(res: ServerResponse, event: string, data: string): void {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

export function streamContainerLogsToSSE(
  res: ServerResponse,
  containerId: string,
  tail: number,
  follow: boolean
): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': stream-start\n\n');

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  const path = `/containers/${encodeURIComponent(containerId)}/logs?stdout=1&stderr=1&tail=${Math.max(
    1,
    tail
  )}&follow=${follow ? 1 : 0}`;

  const req = http.request(
    {
      socketPath: DOCKER_SOCK_PATH,
      path,
      method: 'GET',
      agent,
      headers: {
        Accept: 'application/vnd.docker.raw-stream'
      }
    },
    (dockerRes) => {
      if (dockerRes.statusCode && dockerRes.statusCode >= 400) {
        writeEvent(res, 'error', `Docker API responded with status ${dockerRes.statusCode}`);
        res.end();
        clearInterval(keepAlive);
        return;
      }

      let buffer = Buffer.alloc(0);
      let rawStream = false;

      const flushPayload = (payload: Buffer) => {
        const text = payload.toString('utf8');
        text.split(/\r?\n/).forEach((line) => {
          if (!line) return;
          writeSse(res, line);
        });
      };

      dockerRes.on('data', (chunk: Buffer) => {
        if (rawStream) {
          flushPayload(chunk);
          return;
        }

        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 8) {
          const streamType = buffer[0];
          if (streamType > 2) {
            rawStream = true;
            flushPayload(buffer);
            buffer = Buffer.alloc(0);
            return;
          }
          const payloadLength = buffer.readUInt32BE(4);
          if (buffer.length < 8 + payloadLength) {
            break;
          }
          const payload = buffer.slice(8, 8 + payloadLength);
          flushPayload(payload);
          buffer = buffer.slice(8 + payloadLength);
        }
      });

      dockerRes.on('end', () => {
        if (buffer.length > 0) {
          flushPayload(buffer);
        }
        writeEvent(res, 'end', 'stream closed');
        res.end();
        clearInterval(keepAlive);
      });
    }
  );

  req.on('error', (err) => {
    writeEvent(res, 'error', err.message);
    res.end();
    clearInterval(keepAlive);
  });

  req.end();

  res.on('close', () => {
    req.destroy();
    clearInterval(keepAlive);
  });
}

