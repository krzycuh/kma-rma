import path from 'path';

export type TokenMap = { [token: string]: string };
export const VALID_TOKENS: TokenMap = {};

(process.env.TOKENS || '')
  .split(',')
  .forEach(pair => {
    const [token, name] = pair.split('->');
    if (token && name) VALID_TOKENS[token] = name;
  });

export const PORT = parseInt(process.env.PORT || '3000', 10);

const getPublicDir = () => {
  const cwd = process.env.NODE_CWD || process.cwd();
  return path.join(cwd, '..', 'frontend', 'dist');
};

export const PUBLIC_DIR = getPublicDir();


