export const DEFAULT_ACCEPT_HEADER = 'text/html,application/json;q=0.9,*/*;q=0.8';
export const DEFAULT_USER_AGENT = 'community-portrait-analysis/0.1';

type BuildDefaultHeadersOptions = {
  accept?: string;
  headers?: HeadersInit;
  userAgent?: string;
};

export function buildDefaultHeaders(options: BuildDefaultHeadersOptions = {}): Headers {
  const headers = new Headers({
    Accept: options.accept ?? DEFAULT_ACCEPT_HEADER,
    'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
  });

  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

export function headersToObject(headers: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};

  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });

  return result;
}
