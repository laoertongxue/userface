import Bottleneck from 'bottleneck';
import type { RateLimiter, RateLimitPolicy } from '@/src/contexts/source-acquisition/infrastructure/resilience/RateLimiter';

type LimiterFactory = (policy: RateLimitPolicy) => Bottleneck;

function buildLimiterCacheKey(key: string, policy: RateLimitPolicy): string {
  return `${key}:${policy.maxConcurrent}:${policy.minTimeMs}`;
}

export class BottleneckRateLimiter implements RateLimiter {
  private readonly limiters = new Map<string, Bottleneck>();

  constructor(
    private readonly limiterFactory: LimiterFactory = (policy) =>
      new Bottleneck({
        maxConcurrent: policy.maxConcurrent,
        minTime: policy.minTimeMs,
      }),
  ) {}

  schedule<T>(key: string, policy: RateLimitPolicy, task: () => Promise<T>): Promise<T> {
    const cacheKey = buildLimiterCacheKey(key, policy);
    const limiter = this.limiters.get(cacheKey) ?? this.createLimiter(cacheKey, policy);
    return limiter.schedule(task);
  }

  private createLimiter(cacheKey: string, policy: RateLimitPolicy): Bottleneck {
    const limiter = this.limiterFactory(policy);
    this.limiters.set(cacheKey, limiter);
    return limiter;
  }
}
