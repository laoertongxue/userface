import type {
  MetricEntry,
  ObservabilitySink,
  StructuredLogEntry,
} from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilitySink';

type ConsoleObservabilitySinkInput = {
  enabled?: boolean;
};

export class ConsoleObservabilitySink implements ObservabilitySink {
  private readonly enabled: boolean;

  constructor(input: ConsoleObservabilitySinkInput = {}) {
    this.enabled = input.enabled ?? process.env.NODE_ENV !== 'test';
  }

  emitLog(entry: StructuredLogEntry): void {
    if (!this.enabled) {
      return;
    }

    const payload = JSON.stringify(entry);

    if (entry.level === 'error') {
      console.error(payload);
      return;
    }

    if (entry.level === 'warn') {
      console.warn(payload);
      return;
    }

    if (entry.level === 'debug') {
      console.debug(payload);
      return;
    }

    console.info(payload);
  }

  emitMetric(entry: MetricEntry): void {
    if (!this.enabled) {
      return;
    }

    console.info(
      JSON.stringify({
        type: 'metric',
        ...entry,
      }),
    );
  }
}

export const defaultObservabilitySink = new ConsoleObservabilitySink();
