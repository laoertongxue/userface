import type { RateLimitPolicy } from '@/src/contexts/source-acquisition/infrastructure/resilience/RateLimiter';

export const V2EX_REQUEST_JITTER_MIN_MS = 800;
export const V2EX_REQUEST_JITTER_MAX_MS = 1500;

export const V2EX_RATE_LIMIT_POLICY: RateLimitPolicy = {
  maxConcurrent: 1,
  minTimeMs: 0,
};

export function buildV2exRateLimitKey(): string {
  return 'domain:www.v2ex.com';
}

export function getV2exRequestJitterMs(random: () => number = Math.random): number {
  const range = V2EX_REQUEST_JITTER_MAX_MS - V2EX_REQUEST_JITTER_MIN_MS;
  return V2EX_REQUEST_JITTER_MIN_MS + Math.round(random() * range);
}

export async function waitForV2exRequestJitter(
  random: () => number = Math.random,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
): Promise<void> {
  await sleep(getV2exRequestJitterMs(random));
}
