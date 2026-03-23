import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  delete process.env.FEATURE_ANALYZE_ENABLED;
  delete process.env.FEATURE_CLUSTER_ANALYSIS_ENABLED;
  delete process.env.FEATURE_NARRATIVE_ENABLED;
  delete process.env.FEATURE_MINIMAX_ENABLED;
  delete process.env.RELEASE_SAFETY_MODE;
  delete process.env.INCIDENT_ACTIVE;
  delete process.env.INCIDENT_SEVERITY;
  delete process.env.INCIDENT_REASON;
  delete process.env.INCIDENT_STARTED_AT;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('/api/analyze route', () => {
  test('returns 400 for invalid requests and still attaches x-trace-id', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    const response = await POST(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          identity: {
            accounts: [],
          },
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

  test('returns the existing analyze payload contract and attaches x-trace-id', async () => {
    vi.resetModules();
    vi.doMock('@/src/app-services/analyze/runAnalyzePipeline', () => ({
      runAnalyzePipeline: async () => ({
        portrait: {
          archetype: 'discussion-oriented',
          tags: ['discussion-heavy'],
          summary: '规则摘要仍然存在。',
          confidence: 0.71,
        },
        evidence: [],
        metrics: {
          totalActivities: 12,
          topicCount: 3,
          replyCount: 9,
          avgTextLength: 88,
          activeDays: 5,
        },
        communityBreakdowns: [],
        warnings: [],
      }),
    }));

    const { POST } = await import('@/app/api/analyze/route');
    const response = await POST(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          identity: {
            accounts: [{ community: 'v2ex', handle: 'alpha' }],
          },
          options: {
            locale: 'zh-CN',
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      portrait: {
        archetype: 'discussion-oriented',
        summary: '规则摘要仍然存在。',
      },
      metrics: {
        totalActivities: 12,
      },
      evidence: [],
      communityBreakdowns: [],
      warnings: [],
    });

    vi.doUnmock('@/src/app-services/analyze/runAnalyzePipeline');
  });

  test('returns release guard rejection payload when analyze is disabled', async () => {
    vi.resetModules();
    process.env.FEATURE_ANALYZE_ENABLED = 'false';
    const runAnalyzePipeline = vi.fn();
    vi.doMock('@/src/app-services/analyze/runAnalyzePipeline', () => ({
      runAnalyzePipeline,
    }));

    const { POST } = await import('@/app/api/analyze/route');
    const response = await POST(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          identity: {
            accounts: [{ community: 'v2ex', handle: 'alpha' }],
          },
          options: {
            locale: 'zh-CN',
          },
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      error: {
        code: 'RELEASE_ANALYZE_DISABLED',
      },
    });
    expect(runAnalyzePipeline).not.toHaveBeenCalled();

    vi.doUnmock('@/src/app-services/analyze/runAnalyzePipeline');
  });

  test('returns release guard rejection payload when cluster analysis is disabled', async () => {
    vi.resetModules();
    process.env.FEATURE_CLUSTER_ANALYSIS_ENABLED = 'false';
    const runAnalyzePipeline = vi.fn();
    vi.doMock('@/src/app-services/analyze/runAnalyzePipeline', () => ({
      runAnalyzePipeline,
    }));

    const { POST } = await import('@/app/api/analyze/route');
    const response = await POST(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          identity: {
            accounts: [
              { community: 'v2ex', handle: 'alpha' },
              { community: 'guozaoke', handle: 'beta' },
            ],
          },
          options: {
            locale: 'zh-CN',
          },
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      error: {
        code: 'RELEASE_CLUSTER_DISABLED',
      },
    });
    expect(runAnalyzePipeline).not.toHaveBeenCalled();

    vi.doUnmock('@/src/app-services/analyze/runAnalyzePipeline');
  });

  test('forces narrative to rule-only when MiniMax is disabled but analyze remains allowed', async () => {
    vi.resetModules();
    process.env.FEATURE_MINIMAX_ENABLED = 'false';
    const runAnalyzePipeline = vi.fn(async () => ({
      portrait: {
        archetype: 'discussion-oriented',
        tags: ['discussion-heavy'],
        summary: '规则摘要仍然存在。',
        confidence: 0.71,
      },
      evidence: [],
      metrics: {
        totalActivities: 12,
        topicCount: 3,
        replyCount: 9,
        avgTextLength: 88,
        activeDays: 5,
      },
      communityBreakdowns: [],
      warnings: [],
    }));
    vi.doMock('@/src/app-services/analyze/runAnalyzePipeline', () => ({
      runAnalyzePipeline,
    }));

    const { POST } = await import('@/app/api/analyze/route');
    const response = await POST(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          identity: {
            accounts: [{ community: 'v2ex', handle: 'alpha' }],
          },
          options: {
            locale: 'zh-CN',
            llmProvider: 'minimax',
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(runAnalyzePipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          llmProvider: 'minimax',
        }),
      }),
      expect.objectContaining({
        narrativeModeOverride: 'RULE_ONLY',
      }),
    );

    vi.doUnmock('@/src/app-services/analyze/runAnalyzePipeline');
  });

  test('returns governance rejection payload when analyze accounts exceed the budget', async () => {
    vi.resetModules();
    const runAnalyzePipeline = vi.fn();
    vi.doMock('@/src/app-services/analyze/runAnalyzePipeline', () => ({
      runAnalyzePipeline,
    }));

    const { POST } = await import('@/app/api/analyze/route');
    const response = await POST(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          identity: {
            accounts: Array.from({ length: 7 }, (_, index) => ({
              community: 'v2ex',
              handle: `alpha-${index}`,
            })),
          },
          options: {
            locale: 'zh-CN',
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      error: {
        code: 'GOVERNANCE_TOO_MANY_ACCOUNTS',
      },
    });
    expect(runAnalyzePipeline).not.toHaveBeenCalled();

    vi.doUnmock('@/src/app-services/analyze/runAnalyzePipeline');
  });
});
