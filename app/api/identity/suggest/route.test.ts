import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  delete process.env.FEATURE_SUGGEST_ENABLED;
  delete process.env.RELEASE_SAFETY_MODE;
  delete process.env.INCIDENT_ACTIVE;
  delete process.env.INCIDENT_SEVERITY;
  delete process.env.INCIDENT_REASON;
  delete process.env.INCIDENT_STARTED_AT;
  vi.resetModules();
  vi.restoreAllMocks();
});

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
    expect(response.headers.get('x-trace-id')).toBeTruthy();
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
    expect(response.headers.get('x-trace-id')).toBeTruthy();
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

  test('returns release guard rejection payload when suggest is disabled', async () => {
    vi.resetModules();
    process.env.FEATURE_SUGGEST_ENABLED = 'false';
    const execute = vi.fn();
    vi.doMock('@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks', () => ({
      SuggestIdentityLinks: class SuggestIdentityLinks {
        async execute() {
          return execute();
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

    expect(response.status).toBe(503);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      error: {
        code: 'RELEASE_SUGGEST_DISABLED',
      },
    });
    expect(execute).not.toHaveBeenCalled();

    vi.doUnmock('@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks');
  });

  test('returns governance rejection payload when estimated suggestion pairs exceed the budget', async () => {
    vi.resetModules();
    const execute = vi.fn();
    vi.doMock('@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks', () => ({
      SuggestIdentityLinks: class SuggestIdentityLinks {
        async execute() {
          return execute();
        }
      },
    }));

    const { POST } = await import('@/app/api/identity/suggest/route');
    const response = await POST(
      new Request('http://localhost/api/identity/suggest', {
        method: 'POST',
        body: JSON.stringify({
          accounts: Array.from({ length: 7 }, (_, index) => ({
            community: index % 2 === 0 ? 'v2ex' : 'guozaoke',
            handle: `alpha-${index}`,
          })),
          maxSuggestions: 10,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      error: {
        code: 'GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS',
      },
    });
    expect(execute).not.toHaveBeenCalled();

    vi.doUnmock('@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks');
  });
});
