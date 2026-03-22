export type AcquisitionErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_4XX'
  | 'UPSTREAM_5XX'
  | 'INVALID_JSON';

type AcquisitionErrorInput = {
  code: AcquisitionErrorCode;
  message: string;
  url?: string;
  status?: number;
  isRetriable: boolean;
  cause?: unknown;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class AcquisitionError extends Error {
  readonly code: AcquisitionErrorCode;
  readonly url?: string;
  readonly status?: number;
  readonly isRetriable: boolean;
  readonly cause?: unknown;

  constructor(input: AcquisitionErrorInput) {
    super(input.message);
    this.name = 'AcquisitionError';
    this.code = input.code;
    this.url = input.url;
    this.status = input.status;
    this.isRetriable = input.isRetriable;
    this.cause = input.cause;
  }

  static network(url?: string, cause?: unknown): AcquisitionError {
    return new AcquisitionError({
      code: 'NETWORK_ERROR',
      message: 'Network request failed.',
      url,
      isRetriable: true,
      cause,
    });
  }

  static timeout(url?: string, cause?: unknown): AcquisitionError {
    return new AcquisitionError({
      code: 'TIMEOUT',
      message: 'Upstream request timed out.',
      url,
      isRetriable: true,
      cause,
    });
  }

  static invalidJson(url?: string, status?: number, cause?: unknown): AcquisitionError {
    return new AcquisitionError({
      code: 'INVALID_JSON',
      message: 'Upstream response did not contain valid JSON.',
      url,
      status,
      isRetriable: false,
      cause,
    });
  }

  static fromStatus(status: number, url?: string): AcquisitionError {
    if (status === 429) {
      return new AcquisitionError({
        code: 'RATE_LIMITED',
        message: 'Upstream service rate limited the request.',
        url,
        status,
        isRetriable: true,
      });
    }

    if (status >= 500) {
      return new AcquisitionError({
        code: 'UPSTREAM_5XX',
        message: `Upstream service failed with status ${status}.`,
        url,
        status,
        isRetriable: true,
      });
    }

    return new AcquisitionError({
      code: 'UPSTREAM_4XX',
      message: `Upstream service returned status ${status}.`,
      url,
      status,
      isRetriable: status === 408,
    });
  }
}

export function isAcquisitionError(error: unknown): error is AcquisitionError {
  return error instanceof AcquisitionError;
}

export function ensureAcquisitionError(error: unknown, url?: string): AcquisitionError {
  if (isAcquisitionError(error)) {
    return error;
  }

  if (isAbortError(error)) {
    return AcquisitionError.timeout(url, error);
  }

  return AcquisitionError.network(url, error);
}
