export type RateLimitPolicy = {
  maxRequests: number;
  windowSeconds: number;
};

export type RateLimitConsumeResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
};

export interface RateLimitAdapter {
  consume(key: string, policy: RateLimitPolicy): Promise<RateLimitConsumeResult>;
}
