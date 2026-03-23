import type {
  MetricEntry,
  ObservabilitySink,
  StructuredLogEntry,
} from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilitySink';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { createTraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';

export class MemoryObservabilitySink implements ObservabilitySink {
  readonly logs: StructuredLogEntry[] = [];
  readonly metrics: MetricEntry[] = [];

  emitLog(entry: StructuredLogEntry): void {
    this.logs.push(entry);
  }

  emitMetric(entry: MetricEntry): void {
    this.metrics.push(entry);
  }
}

export function createTestObservabilityContext(
  sink = new MemoryObservabilitySink(),
  overrides: Partial<ReturnType<typeof createTraceContext>> = {},
): ObservabilityContext {
  return new ObservabilityContext({
    trace: {
      traceId: overrides.traceId ?? 'trace-test',
      requestId: overrides.requestId ?? 'request-test',
      route: overrides.route ?? '/api/test',
      operation: overrides.operation ?? 'test.operation',
      startedAt: overrides.startedAt ?? '2026-03-23T10:00:00.000Z',
      parentTraceId: overrides.parentTraceId,
    },
    sink,
  });
}
