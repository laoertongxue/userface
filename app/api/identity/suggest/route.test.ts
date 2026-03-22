import { describe, expect, test, vi } from 'vitest';

describe('/api/identity/suggest route', () => {
  test('returns 400 for invalid requests', async () => {
    const { POST } = await import('@/app/api/identity/suggest/route');
    const response = await POST(
      new Request('http://localhost/api/identity/suggest', {
        method: 'POST',
        body: JSON.stringify({
          accounts: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
      },
    });
  });

  test('returns suggestion payload for valid requests', async () => {
    vi.resetModules();
    vi.doMock('@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks', () => ({
      SuggestIdentityLinks: class SuggestIdentityLinks {
        async execute() {
          return {
            suggestions: [
              {
                candidateAccounts: [
                  { community: 'v2ex', handle: 'alpha' },
                  { community: 'guozaoke', handle: 'alpha' },
                ],
                confidence: 0.86,
                reasons: ['homepage-exact-match', 'handle-exact-match'],
                status: 'PENDING',
                sourceHint: 'Strong identity hint from homepage and normalized handle match.',
              },
            ],
            inspectedAccounts: [
              { community: 'v2ex', handle: 'alpha' },
              { community: 'guozaoke', handle: 'alpha' },
            ],
            ignoredPairs: [],
            warnings: [],
          };
        }
      },
    }));

    const { POST } = await import('@/app/api/identity/suggest/route');
    const response = await POST(
      new Request('http://localhost/api/identity/suggest', {
        method: 'POST',
        body: JSON.stringify({
          accounts: [
            { community: 'v2ex', handle: 'alpha' },
            { community: 'guozaoke', handle: 'alpha' },
          ],
          maxSuggestions: 5,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      suggestions: [
        {
          confidence: 0.86,
          status: 'PENDING',
        },
      ],
      inspectedAccounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'alpha' },
      ],
    });

    vi.doUnmock('@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks');
  });
});
