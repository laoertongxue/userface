import type {
  RateLimitAdapter,
  RateLimitConsumeResult,
  RateLimitPolicy,
} from '@/src/contexts/platform-governance/infrastructure/governance/RateLimitAdapter';

type Bucket = {
  count: number;
  windowStartedAtMs: number;
};

export class InMemoryRateLimitAdapter implements RateLimitAdapter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitConsumeResult> {
    const currentTime = this.now();
    const windowMs = policy.windowSeconds * 1000;
    const currentBucket = this.buckets.get(key);

    if (!currentBucket || currentTime - currentBucket.windowStartedAtMs >= windowMs) {
      this.buckets.set(key, {
        count: 1,
        windowStartedAtMs: currentTime,
      });

      return {
        allowed: true,
        remaining: Math.max(0, policy.maxRequests - 1),
      };
    }

    if (currentBucket.count >= policy.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowMs - (currentTime - currentBucket.windowStartedAtMs)) / 1000),
      );

      return {
        allowed: false,
        retryAfterSeconds,
        remaining: 0,
      };
    }

    currentBucket.count += 1;
    this.buckets.set(key, currentBucket);

    return {
      allowed: true,
      remaining: Math.max(0, policy.maxRequests - currentBucket.count),
    };
  }
}

export const defaultRateLimitAdapter = new InMemoryRateLimitAdapter();
