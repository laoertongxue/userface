import pRetry from 'p-retry';
import { ensureAcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';

export type RetryPolicyOptions = {
  factor?: number;
  maxRetries?: number;
  maxTimeoutMs?: number;
  minTimeoutMs?: number;
  randomize?: boolean;
};

const DEFAULT_RETRY_POLICY: Required<RetryPolicyOptions> = {
  factor: 2,
  maxRetries: 2,
  maxTimeoutMs: 2_000,
  minTimeoutMs: 250,
  randomize: true,
};

export class RetryPolicy {
  constructor(private readonly defaults: RetryPolicyOptions = {}) {}

  async execute<T>(operation: () => Promise<T>, overrides: RetryPolicyOptions = {}): Promise<T> {
    const policy = {
      ...DEFAULT_RETRY_POLICY,
      ...this.defaults,
      ...overrides,
    };

    try {
      return await pRetry(
        async () => {
          try {
            return await operation();
          } catch (error) {
            throw ensureAcquisitionError(error);
          }
        },
        {
          factor: policy.factor,
          maxTimeout: policy.maxTimeoutMs,
          minTimeout: policy.minTimeoutMs,
          randomize: policy.randomize,
          retries: policy.maxRetries,
          shouldRetry: ({ error }) => ensureAcquisitionError(error).isRetriable,
        },
      );
    } catch (error) {
      throw ensureAcquisitionError(error);
    }
  }
}
