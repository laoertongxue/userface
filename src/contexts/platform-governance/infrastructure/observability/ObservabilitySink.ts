import type { TraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import type { NormalizedErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';

export type MetricTagValue = string | number | boolean;
export type MetricTags = Record<string, MetricTagValue>;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type MetricKind = 'counter' | 'timing' | 'gauge';

export type StructuredLogEntry = {
  ts: string;
  level: LogLevel;
  traceId: string;
  requestId: string;
  route: string;
  operation: string;
  event: string;
  message: string;
  context?: Record<string, unknown>;
  errorCode?: NormalizedErrorCode;
};

export type MetricEntry = {
  ts: string;
  kind: MetricKind;
  name: string;
  value: number;
  tags: MetricTags;
  trace: Pick<TraceContext, 'traceId' | 'route' | 'operation'>;
};

export interface ObservabilitySink {
  emitLog(entry: StructuredLogEntry): void;
  emitMetric(entry: MetricEntry): void;
}
