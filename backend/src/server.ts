import http, { IncomingMessage, ServerResponse } from 'http';
import { HOST, PORT, PUBLIC_DIR } from './config';
import { parseUrl } from './utils/urlParser';
import { validateToken } from './middleware/auth';
import { handlePageRoutes, handleNotFound } from './routes/pageRoutes';
import { handleApiRoutes } from './routes/apiRoutes';
import { handleStaticRoutes } from './routes/staticRoutes';

function createServer(): http.Server {
  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const { pathname, token } = parseUrl(req.url || '/');

    // 1. Static files (no auth)
    if (handleStaticRoutes(req, res, pathname)) {
      return;
    }

    // 2. SPA shell (no auth). index.html contains no secrets - all data
    // comes from /api/* which stays token-protected. Serving it without a
    // token is required for the installed PWA: the home-screen icon opens
    // the manifest's start_url ("/") with no ?token=, and the SPA then
    // picks the token up from localStorage (or shows the token form).
    if (handlePageRoutes(req, res, pathname)) {
      return;
    }

    // 3. Auth for API routes (/api/health stays open for Docker HEALTHCHECK)
    const user = validateToken(token);
    if (!user && pathname !== '/api/health') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // 4. API routes
    if (await handleApiRoutes(req, res, pathname, user || '')) {
      return;
    }

    // 5. 404
    handleNotFound(res);
  });

  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(new Date().toISOString(), `Server listening on port ${PORT}`);
    console.log(new Date().toISOString(), `PUBLIC_DIR: ${PUBLIC_DIR}`);
  });
}

export default createServer;
