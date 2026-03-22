import type { RateLimitPolicy } from '@/src/contexts/source-acquisition/infrastructure/resilience/RateLimiter';

export const GUOZAOKE_REQUEST_JITTER_MIN_MS = 1000;
export const GUOZAOKE_REQUEST_JITTER_MAX_MS = 1800;

export const GUOZAOKE_RATE_LIMIT_POLICY: RateLimitPolicy = {
  maxConcurrent: 1,
  minTimeMs: 0,
};

export function buildGuozaokeRateLimitKey(): string {
  return 'domain:www.guozaoke.com';
}

export function getGuozaokeRequestJitterMs(random: () => number = Math.random): number {
  const range = GUOZAOKE_REQUEST_JITTER_MAX_MS - GUOZAOKE_REQUEST_JITTER_MIN_MS;
  return GUOZAOKE_REQUEST_JITTER_MIN_MS + Math.round(random() * range);
}

export async function waitForGuozaokeRequestJitter(
  random: () => number = Math.random,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
): Promise<void> {
  await sleep(getGuozaokeRequestJitterMs(random));
}
