export const TRACE_HEADER_NAME = 'x-trace-id';
export const REQUEST_ID_HEADER_NAME = 'x-request-id';
export const PARENT_TRACE_HEADER_NAME = 'x-parent-trace-id';

export type TraceContext = {
  traceId: string;
  requestId: string;
  route: string;
  operation: string;
  startedAt: string;
  parentTraceId?: string;
};

type CreateTraceContextInput = {
  route: string;
  operation: string;
  headers?: Headers;
  traceId?: string;
  requestId?: string;
  parentTraceId?: string;
  startedAt?: string;
};

function readHeader(headers: Headers | undefined, name: string): string | undefined {
  const value = headers?.get(name)?.trim();
  return value ? value : undefined;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function createTraceContext(input: CreateTraceContextInput): TraceContext {
  const requestId =
    input.requestId ??
    readHeader(input.headers, REQUEST_ID_HEADER_NAME) ??
    generateId();
  const traceId =
    input.traceId ??
    readHeader(input.headers, TRACE_HEADER_NAME) ??
    requestId;

  return {
    traceId,
    requestId,
    route: input.route,
    operation: input.operation,
    startedAt: input.startedAt ?? new Date().toISOString(),
    parentTraceId:
      input.parentTraceId ??
      readHeader(input.headers, PARENT_TRACE_HEADER_NAME),
  };
}

export function createChildTraceContext(
  parent: TraceContext,
  operation: string,
  route = parent.route,
): TraceContext {
  return {
    ...parent,
    route,
    operation,
  };
}

export function attachTraceHeaders(response: Response, trace: TraceContext): Response {
  response.headers.set(TRACE_HEADER_NAME, trace.traceId);
  response.headers.set(REQUEST_ID_HEADER_NAME, trace.requestId);
  return response;
}
