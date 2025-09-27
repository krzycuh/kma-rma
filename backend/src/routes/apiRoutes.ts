import { IncomingMessage, ServerResponse } from 'http';
import { SuccessObject } from '../utils/ControllerResult';
import { MetricsService } from '../metrics/service';
import { getQueryParam } from '../utils/urlParser';
import { METRICS_HISTORY_SIZE, METRICS_POLL_INTERVAL_MS } from '../config';

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

  return false;
}


