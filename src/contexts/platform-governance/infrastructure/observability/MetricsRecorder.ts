import type { MetricName } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import type {
  MetricTagValue,
  MetricTags,
  ObservabilitySink,
} from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilitySink';
import type { TraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { defaultObservabilitySink } from '@/src/contexts/platform-governance/infrastructure/observability/ConsoleObservabilitySink';

function normalizeTags(tags?: MetricTags): MetricTags {
  if (!tags) {
    return {};
  }

  const normalizedEntries = Object.entries(tags)
    .filter((entry): entry is [string, MetricTagValue] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(normalizedEntries);
}

export class MetricsRecorder {
  constructor(
    private readonly trace: TraceContext,
    private readonly sink: ObservabilitySink = defaultObservabilitySink,
  ) {}

  counter(name: MetricName, value = 1, tags?: MetricTags): void {
    this.sink.emitMetric({
      ts: new Date().toISOString(),
      kind: 'counter',
      name,
      value,
      tags: normalizeTags(tags),
      trace: {
        traceId: this.trace.traceId,
        route: this.trace.route,
        operation: this.trace.operation,
      },
    });
  }

  timing(name: MetricName, durationMs: number, tags?: MetricTags): void {
    this.sink.emitMetric({
      ts: new Date().toISOString(),
      kind: 'timing',
      name,
      value: durationMs,
      tags: normalizeTags(tags),
      trace: {
        traceId: this.trace.traceId,
        route: this.trace.route,
        operation: this.trace.operation,
      },
    });
  }

  gauge(name: MetricName, value: number, tags?: MetricTags): void {
    this.sink.emitMetric({
      ts: new Date().toISOString(),
      kind: 'gauge',
      name,
      value,
      tags: normalizeTags(tags),
      trace: {
        traceId: this.trace.traceId,
        route: this.trace.route,
        operation: this.trace.operation,
      },
    });
  }
}
