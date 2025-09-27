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

    // 2. Auth for other routes
    const user = validateToken(token);
    if (!user && pathname !== '/unauthorized') {
      res.writeHead(302, { Location: '/unauthorized' });
      res.end();
      return;
    }

    // 3. API routes
    if (await handleApiRoutes(req, res, pathname, user || '')) {
      return;
    }

    // 4. Page routes
    if (handlePageRoutes(req, res, pathname)) {
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


