import { describe, expect, test, vi } from 'vitest';
import { HttpClient } from '@/src/contexts/source-acquisition/infrastructure/http/HttpClient';
import { RequestExecutor } from '@/src/contexts/source-acquisition/infrastructure/resilience/RequestExecutor';

describe('RequestExecutor', () => {
  test('retries on 500 and eventually succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const executor = new RequestExecutor({
      httpClient: new HttpClient({ fetchImpl }),
    });

    const response = await executor.executeJson<{ ok: boolean }>({
      retryPolicy: {
        maxRetries: 1,
        minTimeoutMs: 1,
        maxTimeoutMs: 1,
        randomize: false,
      },
      url: 'https://example.com/profile',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.data).toEqual({ ok: true });
  });

  test('retries on 429 and eventually succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const executor = new RequestExecutor({
      httpClient: new HttpClient({ fetchImpl }),
    });

    const response = await executor.executeJson<{ ok: boolean }>({
      retryPolicy: {
        maxRetries: 1,
        minTimeoutMs: 1,
        maxTimeoutMs: 1,
        randomize: false,
      },
      url: 'https://example.com/profile',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.data.ok).toBe(true);
  });

  test('does not retry on 404', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not found', { status: 404 }));
    const executor = new RequestExecutor({
      httpClient: new HttpClient({ fetchImpl }),
    });

    await expect(
      executor.executeText({
        retryPolicy: {
          maxRetries: 3,
          minTimeoutMs: 1,
          maxTimeoutMs: 1,
          randomize: false,
        },
        url: 'https://example.com/profile',
      }),
    ).rejects.toMatchObject({
      code: 'UPSTREAM_4XX',
      status: 404,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('returns parsed JSON for executeJson', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"name":"alice"}', { status: 200 }));
    const executor = new RequestExecutor({
      httpClient: new HttpClient({ fetchImpl }),
    });

    const response = await executor.executeJson<{ name: string }>({
      url: 'https://example.com/profile',
    });

    expect(response.data).toEqual({ name: 'alice' });
  });

  test('throws INVALID_JSON for malformed JSON', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not-json', { status: 200 }));
    const executor = new RequestExecutor({
      httpClient: new HttpClient({ fetchImpl }),
    });

    await expect(
      executor.executeJson({
        url: 'https://example.com/profile',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_JSON',
      isRetriable: false,
    });
  });
});
