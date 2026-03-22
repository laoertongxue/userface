import { afterEach, describe, expect, test, vi } from 'vitest';
import { HttpClient } from '@/src/contexts/source-acquisition/infrastructure/http/HttpClient';

describe('HttpClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('appends query parameters to the request URL', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      return new Response(String(input), { status: 200 });
    });
    const client = new HttpClient({ fetchImpl });

    await client.fetchText({
      query: {
        include: ['topics', 'replies'],
        page: 2,
        q: 'alice',
      },
      url: 'https://example.com/member',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const firstCall = fetchImpl.mock.calls[0];

    expect(firstCall?.[0]).toBe(
      'https://example.com/member?include=topics&include=replies&page=2&q=alice',
    );
  });

  test('throws TIMEOUT when the request exceeds timeoutMs', async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;

        signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      });
    });
    const client = new HttpClient({ fetchImpl });
    const request = client.fetchText({
      timeoutMs: 25,
      url: 'https://example.com/slow',
    });
    const expectation = expect(request).rejects.toMatchObject({
      code: 'TIMEOUT',
      isRetriable: true,
    });

    await vi.advanceTimersByTimeAsync(25);
    await expectation;
  });
});
