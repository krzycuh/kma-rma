import { IncomingMessage, ServerResponse } from 'http';
import { SuccessObject, Error as ErrorResult } from '../utils/ControllerResult';
import { MetricsService } from '../metrics/service';
import { ENABLE_DOCKER_STATS, ENABLE_ROUTER_STATS, LOGS_MAX_TAIL } from '../config';
import { getContainersStats } from '../metrics/dockerStats';
import { getQueryParam } from '../utils/urlParser';
import { METRICS_HISTORY_SIZE, METRICS_POLL_INTERVAL_MS, ROUTER_POLL_INTERVAL_MS } from '../config';
import { streamContainerLogsToSSE } from '../metrics/dockerLogs';
import { DockerError } from '../docker/client';
import { pullImageAndRecreateIfNeeded, pullImageAndRecreateDetached } from '../docker/imageManager';
import { isSelfContainer } from '../docker/selfDetector';
import { streamManager } from '../sse/streamManager';
import { startContainerBroadcast } from '../sse/containerBroadcaster';
import { startRouterBroadcast, getRouterService } from '../router/broadcaster';
import { SSEEventType } from '../sse/events';

const metricsService = new MetricsService();
metricsService.start();

// Start SSE infrastructure
streamManager.start();
startContainerBroadcast(5000);
startRouterBroadcast(ROUTER_POLL_INTERVAL_MS);

export async function handleApiRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  user: string
): Promise<boolean> {
  // SSE stream endpoint - unified real-time data
  if (req.method === 'GET' && pathname === '/api/stream') {
    streamManager.addClient(user, res);

    // Send initial state
    const latest = metricsService.getLatest();
    if (latest) {
      streamManager.broadcast({
        type: SSEEventType.METRICS,
        data: latest
      });
    }

    if (ENABLE_DOCKER_STATS) {
      try {
        const containers = await getContainersStats();
        streamManager.broadcast({
          type: SSEEventType.CONTAINERS,
          data: containers
        });
      } catch {
        // Ignore initial container fetch errors
      }
    }

    // Send initial router data
    if (ENABLE_ROUTER_STATS) {
      const routerService = getRouterService();
      if (routerService) {
        const routerResult = routerService.getLastResult();
        if (routerResult) {
          streamManager.broadcast({
            type: SSEEventType.ROUTER,
            data: routerResult
          });
        }
      }
    }

    // Connection stays open - handled by streamManager
    return true;
  }

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

  // Keep /api/history for initial data load
  if (req.method === 'GET' && pathname === '/api/history') {
    const limitStr = getQueryParam(req.url || '', 'limit');
    const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
    const history = metricsService.getHistory(Number.isFinite(limit as number) ? limit : undefined);
    const result = new SuccessObject(history);
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  // Router history endpoint
  if (req.method === 'GET' && pathname === '/api/router/history') {
    if (!ENABLE_ROUTER_STATS) {
      const result = new ErrorResult('Router stats disabled', 404);
      res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
      res.end(result.getBody());
      return true;
    }

    const routerService = getRouterService();
    if (!routerService) {
      const result = new ErrorResult('Router service not initialized', 503);
      res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
      res.end(result.getBody());
      return true;
    }

    const limitStr = getQueryParam(req.url || '', 'limit');
    const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
    const history = routerService.getHistory(Number.isFinite(limit as number) ? limit : undefined);
    const result = new SuccessObject(history);
    res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
    res.end(result.getBody());
    return true;
  }

  // Container logs streaming (SSE)
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

    if (req.method === 'POST' && pathname.startsWith('/api/containers/') && pathname.endsWith('/update')) {
      if (!ENABLE_DOCKER_STATS) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Docker stats disabled');
        return true;
      }
      const parts = pathname.split('/');
      const id = parts[3];
      if (!id) {
        const result = new ErrorResult('Container id required', 400);
        res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
        res.end(result.getBody());
        return true;
      }
      try {
        // Check if this is a self-restart (restarting the container that hosts this backend)
        const isSelf = await isSelfContainer(id);

        let outcome;
        if (isSelf) {
          // Use detached execution for self-restart to avoid killing the process mid-operation
          outcome = await pullImageAndRecreateDetached(id);
        } else {
          // Normal restart for other containers
          outcome = await pullImageAndRecreateIfNeeded(id);
        }

        const result = new SuccessObject(outcome);
        res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
        res.end(result.getBody());
      } catch (err) {
        const status = err instanceof DockerError && err.statusCode ? err.statusCode : 500;
        const message = err instanceof Error ? err.message : 'Unknown Docker error';
        const result = new ErrorResult(message, status);
        res.writeHead(result.getStatusCode(), { 'Content-Type': result.getContentType() });
        res.end(result.getBody());
      }
      return true;
    }

  return false;
}


