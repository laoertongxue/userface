import type { ObservabilitySink } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilitySink';
import type { TraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { defaultObservabilitySink } from '@/src/contexts/platform-governance/infrastructure/observability/ConsoleObservabilitySink';
import { MetricsRecorder } from '@/src/contexts/platform-governance/infrastructure/observability/MetricsRecorder';
import { StructuredLogger } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import {
  createChildTraceContext,
  createTraceContext,
  type TraceContext as TraceContextType,
} from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { SpanTimer } from '@/src/contexts/platform-governance/infrastructure/observability/SpanTimer';

type ObservabilityContextInput = {
  trace: TraceContext;
  sink?: ObservabilitySink;
};

type RequestObservabilityInput = {
  request: Request;
  route: string;
  operation: string;
  sink?: ObservabilitySink;
};

export class ObservabilityContext {
  readonly trace: TraceContextType;
  readonly logger: StructuredLogger;
  readonly metrics: MetricsRecorder;
  readonly sink: ObservabilitySink;

  constructor(input: ObservabilityContextInput) {
    this.trace = input.trace;
    this.sink = input.sink ?? defaultObservabilitySink;
    this.logger = new StructuredLogger(this.trace, this.sink);
    this.metrics = new MetricsRecorder(this.trace, this.sink);
  }

  static fromRequest(input: RequestObservabilityInput): ObservabilityContext {
    return new ObservabilityContext({
      trace: createTraceContext({
        headers: input.request.headers,
        route: input.route,
        operation: input.operation,
      }),
      sink: input.sink,
    });
  }

  child(operation: string, route = this.trace.route): ObservabilityContext {
    return new ObservabilityContext({
      trace: createChildTraceContext(this.trace, operation, route),
      sink: this.sink,
    });
  }

  startSpan(operation = this.trace.operation): SpanTimer {
    return new SpanTimer(operation);
  }
}
