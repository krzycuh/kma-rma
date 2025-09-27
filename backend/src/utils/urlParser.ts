export interface ParsedUrl {
  pathname: string;
  token: string | null;
}

export function parseUrl(url: string): ParsedUrl {
  const urlObj = new URL(url, `http://localhost`);
  return {
    pathname: urlObj.pathname,
    token: urlObj.searchParams.get('token'),
  };
}

export function getQueryParam(url: string, param: string): string | null {
  if (!url || url.trim() === '') {
    return null;
  }
  try {
    const urlObj = new URL(url, `http://localhost`);
    return urlObj.searchParams.get(param);
  } catch {
    return null;
  }
}


