export type NarrativeGatewayErrorCode =
  | 'CONFIG_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE'
  | 'DISABLED'
  | 'UNSUPPORTED_PROVIDER';

type NarrativeGatewayErrorInput = {
  code: NarrativeGatewayErrorCode;
  message: string;
  provider?: string;
  status?: number;
  retriable: boolean;
  cause?: unknown;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class NarrativeGatewayError extends Error {
  readonly code: NarrativeGatewayErrorCode;
  readonly provider?: string;
  readonly status?: number;
  readonly retriable: boolean;
  readonly cause?: unknown;

  constructor(input: NarrativeGatewayErrorInput) {
    super(input.message);
    this.name = 'NarrativeGatewayError';
    this.code = input.code;
    this.provider = input.provider;
    this.status = input.status;
    this.retriable = input.retriable;
    this.cause = input.cause;
  }

  static config(message: string, provider?: string): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'CONFIG_ERROR',
      message,
      provider,
      retriable: false,
    });
  }

  static timeout(provider?: string, cause?: unknown): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'TIMEOUT',
      message: 'Narrative provider request timed out.',
      provider,
      retriable: true,
      cause,
    });
  }

  static rateLimited(provider?: string, status = 429): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'RATE_LIMITED',
      message: 'Narrative provider rate limited the request.',
      provider,
      status,
      retriable: true,
    });
  }

  static upstream(provider: string | undefined, status?: number, cause?: unknown): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'UPSTREAM_ERROR',
      message:
        typeof status === 'number'
          ? `Narrative provider failed with status ${status}.`
          : 'Narrative provider request failed.',
      provider,
      status,
      retriable: typeof status === 'number' ? status >= 500 : true,
      cause,
    });
  }

  static invalidResponse(message: string, provider?: string, cause?: unknown): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'INVALID_RESPONSE',
      message,
      provider,
      retriable: false,
      cause,
    });
  }

  static disabled(message = 'Narrative generation is disabled.'): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'DISABLED',
      message,
      retriable: false,
    });
  }

  static unsupportedProvider(provider?: string): NarrativeGatewayError {
    return new NarrativeGatewayError({
      code: 'UNSUPPORTED_PROVIDER',
      message: `Unsupported narrative provider: ${provider ?? 'unknown'}.`,
      provider,
      retriable: false,
    });
  }
}

export function isNarrativeGatewayError(error: unknown): error is NarrativeGatewayError {
  return error instanceof NarrativeGatewayError;
}

export function ensureNarrativeGatewayError(
  error: unknown,
  provider?: string,
): NarrativeGatewayError {
  if (isNarrativeGatewayError(error)) {
    return error;
  }

  if (isAbortError(error)) {
    return NarrativeGatewayError.timeout(provider, error);
  }

  return NarrativeGatewayError.upstream(provider, undefined, error);
}

