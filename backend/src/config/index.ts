import path from 'path';

export type TokenMap = { [token: string]: string };
export const VALID_TOKENS: TokenMap = {};

(process.env.TOKENS || '')
  .split(',')
  .forEach(pair => {
    const [token, name] = pair.split('->');
    if (token && name) VALID_TOKENS[token] = name;
  });

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = process.env.HOST || '0.0.0.0';

export const METRICS_POLL_INTERVAL_MS = parseInt(
  process.env.METRICS_POLL_INTERVAL_MS || '2000',
  10
);
export const METRICS_HISTORY_SIZE = parseInt(
  process.env.METRICS_HISTORY_SIZE || '300',
  10
);

const getPublicDir = () => {
  const cwd = process.env.NODE_CWD || process.cwd();
  return path.join(cwd, '..', 'frontend', 'dist');
};

export const PUBLIC_DIR = getPublicDir();

export const ENABLE_DOCKER_STATS = (process.env.ENABLE_DOCKER_STATS || 'false') === 'true';
export const DOCKER_SOCK_PATH = process.env.DOCKER_SOCK_PATH || '/var/run/docker.sock';


