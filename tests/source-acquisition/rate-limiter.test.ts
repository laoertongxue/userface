import { describe, expect, test } from 'vitest';
import { BottleneckRateLimiter } from '@/src/contexts/source-acquisition/infrastructure/resilience/BottleneckRateLimiter';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('BottleneckRateLimiter', () => {
  test('runs tasks serially for the same key when maxConcurrent is 1', async () => {
    const limiter = new BottleneckRateLimiter();
    let activeCount = 0;
    let maxObservedConcurrency = 0;

    const runTask = async (value: number) =>
      limiter.schedule(
        'same-key',
        {
          maxConcurrent: 1,
          minTimeMs: 0,
        },
        async () => {
          activeCount += 1;
          maxObservedConcurrency = Math.max(maxObservedConcurrency, activeCount);
          await wait(20);
          activeCount -= 1;
          return value;
        },
      );

    const results = await Promise.all([runTask(1), runTask(2), runTask(3)]);

    expect(results).toEqual([1, 2, 3]);
    expect(maxObservedConcurrency).toBe(1);
  });
});
