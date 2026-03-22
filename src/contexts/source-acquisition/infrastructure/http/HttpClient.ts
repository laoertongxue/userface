import { AcquisitionError, ensureAcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';

type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;

export type QueryParams = Record<string, QueryValue>;

export type HttpRequestOptions = {
  body?: BodyInit;
  headers?: HeadersInit;
  method?: string;
  query?: QueryParams;
  signal?: AbortSignal;
  timeoutMs?: number;
  url: string;
};

export type HttpTextResponse = {
  bodyText: string;
  headers: Headers;
  ok: boolean;
  status: number;
  url: string;
};

export type HttpJsonResponse<T> = HttpTextResponse & {
  data: T;
};

type HttpClientOptions = {
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function appendQueryParams(url: URL, query?: QueryParams): URL {
  if (!query) {
    return url;
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry) => {
      url.searchParams.append(key, String(entry));
    });
  });

  return url;
}

function createRequestUrl(input: string, query?: QueryParams): string {
  const url = appendQueryParams(new URL(input), query);
  return url.toString();
}

function combineSignals(signals: AbortSignal[]): AbortSignal | undefined {
  const activeSignals = signals.filter(Boolean);

  if (activeSignals.length === 0) {
    return undefined;
  }

  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(activeSignals);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener('abort', abort, { once: true });
  });

  return controller.signal;
}

export function parseJsonResponse<T>(response: HttpTextResponse): HttpJsonResponse<T> {
  try {
    return {
      ...response,
      data: JSON.parse(response.bodyText) as T,
    };
  } catch (error) {
    throw AcquisitionError.invalidJson(response.url, response.status, error);
  }
}

export class HttpClient {
  private readonly defaultTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
  }

  async fetchText(options: HttpRequestOptions): Promise<HttpTextResponse> {
    const requestUrl = createRequestUrl(options.url, options.query);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutController = new AbortController();
    const signal = combineSignals([timeoutController.signal, options.signal].filter(Boolean) as AbortSignal[]);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, timeoutMs);
    }

    try {
      const response = await this.fetchImpl(requestUrl, {
        body: options.body,
        headers: options.headers,
        method: options.method ?? 'GET',
        signal,
      });
      const bodyText = await response.text();

      return {
        bodyText,
        headers: response.headers,
        ok: response.ok,
        status: response.status,
        url: response.url || requestUrl,
      };
    } catch (error) {
      if (timedOut) {
        throw AcquisitionError.timeout(requestUrl, error);
      }

      throw ensureAcquisitionError(error, requestUrl);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async fetchJson<T>(options: HttpRequestOptions): Promise<HttpJsonResponse<T>> {
    const response = await this.fetchText(options);
    return parseJsonResponse<T>(response);
  }
}
