import { IncomingMessage, ServerResponse } from 'http';
import { SuccessObject } from '../utils/ControllerResult';
import { MetricsService } from '../metrics/service';
import { ENABLE_DOCKER_STATS, LOGS_MAX_TAIL } from '../config';
import { getContainersStats } from '../metrics/dockerStats';
import { getQueryParam } from '../utils/urlParser';
import { METRICS_HISTORY_SIZE, METRICS_POLL_INTERVAL_MS } from '../config';
import { streamContainerLogsToSSE } from '../metrics/dockerLogs';

const metricsService = new MetricsService();
metricsService.start();

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

  if (req.method === 'GET' && pathname === '/api/health') {
    const result = new SuccessObject({
      status: 'ok',
      pollIntervalMs: METRICS_POLL_INTERVAL_MS,
      historySize: METRICS_HISTORY_SIZE,
      ts: Date.now()
    });
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/metrics') {
    const latest = metricsService.getLatest();
    const result = new SuccessObject(latest ?? { ts: Date.now(), note: 'no data yet' });
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/history') {
    const limitStr = getQueryParam(req.url || '', 'limit');
    const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
    const history = metricsService.getHistory(Number.isFinite(limit as number) ? limit : undefined);
    const result = new SuccessObject(history);
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/containers') {
    if (!ENABLE_DOCKER_STATS) {
      const result = new SuccessObject([]);
      res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
      res.end(result.getBody());
      return true;
    }
    const list = await getContainersStats();
    const result = new SuccessObject(list);
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/containers/') && pathname.endsWith('/logs')) {
    if (!ENABLE_DOCKER_STATS) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Docker stats disabled');
      return true;
    }
    const parts = pathname.split('/');
    const id = parts[3];
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Container id required');
      return true;
    }
    const tailStr = getQueryParam(req.url || '', 'tail');
    const followStr = getQueryParam(req.url || '', 'follow');
    const tailReq = tailStr ? parseInt(tailStr, 10) : 200;
    const tail = Number.isFinite(tailReq) ? Math.min(Math.max(tailReq, 1), LOGS_MAX_TAIL) : 200;
    const follow = followStr === 'true' || followStr === '1';
    streamContainerLogsToSSE(res, id, tail, follow);
    return true;
  }

  return false;
}


