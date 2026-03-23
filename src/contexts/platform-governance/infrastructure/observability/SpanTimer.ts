export type SpanOutcome = 'success' | 'failure' | 'partial';

export type CompletedSpan = {
  operation: string;
  durationMs: number;
  outcome: SpanOutcome;
};

export class SpanTimer {
  private readonly startedAtMs: number;

  constructor(private readonly operation: string, startedAtMs = Date.now()) {
    this.startedAtMs = startedAtMs;
  }

  finish(outcome: SpanOutcome): CompletedSpan {
    return {
      operation: this.operation,
      durationMs: Math.max(0, Date.now() - this.startedAtMs),
      outcome,
    };
  }
}
