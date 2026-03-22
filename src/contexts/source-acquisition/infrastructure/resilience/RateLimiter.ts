export type RateLimitPolicy = {
  maxConcurrent: number;
  minTimeMs: number;
};

export interface RateLimiter {
  schedule<T>(key: string, policy: RateLimitPolicy, task: () => Promise<T>): Promise<T>;
}
