import { describe, expect, test, vi } from 'vitest';
import {
  readGuozaokeFixture,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type {
  AcquisitionContext,
  ConnectorProbeResult,
  ConnectorSnapshot,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

class TestConnector implements CommunityConnector {
  readonly mode = 'public' as const;
  readonly capabilities = {
    publicProfile: true,
    publicTopics: true,
    publicReplies: true,
    requiresAuth: false,
    supportsPagination: true,
    supportsCrossCommunityHints: false,
  };

  constructor(
    readonly community: 'v2ex' | 'guozaoke' | 'weibo',
    private readonly resolver: (input: FetchSnapshotInput, ctx: AcquisitionContext) => Promise<ConnectorSnapshot>,
  ) {}

  async probe(ref: ExternalAccountRef, _ctx: AcquisitionContext): Promise<ConnectorProbeResult> {
    return {
      ok: true,
      community: ref.community,
      ref,
      warnings: [],
    };
  }

  fetchSnapshot(input: FetchSnapshotInput, ctx: AcquisitionContext): Promise<ConnectorSnapshot> {
    return this.resolver(input, ctx);
  }
}

function buildSnapshot(
  ref: ExternalAccountRef,
  overrides: Partial<ConnectorSnapshot> = {},
): ConnectorSnapshot {
  return {
    ref,
    profile: {
      community: ref.community,
      handle: ref.handle,
      displayName: ref.handle,
      stats: {},
    },
    activities: [],
    diagnostics: {
      fetchedPages: 1,
      fetchedItems: 0,
      elapsedMs: 10,
      degraded: false,
      usedRoutes: ['/profile'],
    },
    warnings: [],
    ...overrides,
  };
}

describe('runAnalyzePipeline', () => {
  test('can run the guozaoke pipeline with a mocked real connector without crashing', async () => {
    vi.resetModules();
    const profileHtml = await readGuozaokeFixture('user-page.html');
    const repliesHtml = await readGuozaokeFixture('replies-page-1.html');
    const topicsHtml = await readGuozaokeFixture('topics-page-1.html');

    vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', async () => {
      const { GuozaokeConnector } = await import(
        '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/connector'
      );

      const connector = new GuozaokeConnector({
        fetcher: {
          fetchUserProfilePage: async () => ({
            bodyText: profileHtml,
            fetchedAt: '2026-03-22T10:00:00.000Z',
            route: '/u/:id',
            url: 'https://www.guozaoke.com/u/sample-user',
          }),
          fetchUserRepliesPage: async () => ({
            bodyText: repliesHtml,
            fetchedAt: '2026-03-22T10:00:00.000Z',
            page: 1,
            route: '/u/:id/replies',
            url: 'https://www.guozaoke.com/u/sample-user/replies?p=1',
          }),
          fetchUserTopicsPage: async () => ({
            bodyText: topicsHtml,
            fetchedAt: '2026-03-22T10:00:00.000Z',
            page: 1,
            route: '/u/:id/topics',
            url: 'https://www.guozaoke.com/u/sample-user/topics?p=1',
          }),
        },
        waitForPageJitter: async () => {},
      });

      return {
        StaticConnectorRegistry: class StaticConnectorRegistry {
          get() {
            return connector;
          }

          list() {
            return [connector];
          }
        },
      };
    });

    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');

    const report = await runAnalyzePipeline({
      identity: {
        accounts: [
          {
            community: 'guozaoke',
            handle: 'sample-user',
          },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(report.metrics.totalActivities).toBe(4);
    expect(report.communityBreakdowns).toMatchObject([
      {
        community: 'guozaoke',
        handle: 'sample-user',
      },
    ]);
    expect(report.warnings).toEqual([]);

    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  });

  test('can run a same-community multi-account pipeline and generate a report', async () => {
    vi.resetModules();

    const connectors = {
      v2ex: new TestConnector('v2ex', async ({ ref }) =>
        buildSnapshot(ref, {
          activities: [
            {
              id: `${ref.handle}-topic`,
              community: 'v2ex',
              handle: ref.handle,
              type: 'topic',
              url: `https://www.v2ex.com/t/${ref.handle}`,
              topicTitle: `${ref.handle} topic`,
              contentText: `Topic from ${ref.handle} with enough detail to be substantive.`,
              excerpt: `Topic from ${ref.handle} with enough detail to be substantive.`,
              publishedAt: ref.handle === 'alpha' ? '2026-03-22T00:00:00.000Z' : '2026-03-21T00:00:00.000Z',
              sourceTrace: {
                route: '/member/:username/topics',
                fetchedAt: '2026-03-22T00:05:00.000Z',
                contentHash: `hash-${ref.handle}`,
              },
            },
          ],
          diagnostics: {
            fetchedPages: 2,
            fetchedItems: 1,
            elapsedMs: 20,
            degraded: false,
            usedRoutes: ['/api/members/show.json', '/member/:username/topics'],
          },
        }),
      ),
      guozaoke: new TestConnector('guozaoke', async ({ ref }) => buildSnapshot(ref)),
      weibo: new TestConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    };

    vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', () => ({
      StaticConnectorRegistry: class StaticConnectorRegistry {
        get(community: 'v2ex' | 'guozaoke' | 'weibo') {
          return connectors[community];
        }

        list() {
          return Object.values(connectors);
        }
      },
    }));

    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');

    const report = await runAnalyzePipeline({
      identity: {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'v2ex', handle: 'beta' },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(report.metrics.totalActivities).toBe(2);
    expect(report.communityBreakdowns).toMatchObject([
      { community: 'v2ex', handle: 'alpha' },
      { community: 'v2ex', handle: 'beta' },
    ]);
    expect(report.warnings).toEqual([]);

    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  });

  test('can run a cross-community cluster pipeline when both accounts succeed', async () => {
    vi.resetModules();

    const connectors = {
      v2ex: new TestConnector('v2ex', async ({ ref }) =>
        buildSnapshot(ref, {
          activities: [
            {
              id: 'alpha-reply',
              community: 'v2ex',
              handle: ref.handle,
              type: 'reply',
              url: 'https://www.v2ex.com/t/alpha',
              topicTitle: 'Alpha reply',
              contentText: 'A substantive reply from alpha about architecture questions.',
              excerpt: 'A substantive reply from alpha about architecture questions.',
              publishedAt: '2026-03-22T00:00:00.000Z',
              sourceTrace: {
                route: '/member/:username/replies',
                fetchedAt: '2026-03-22T00:05:00.000Z',
                contentHash: 'hash-alpha',
              },
            },
          ],
          diagnostics: {
            fetchedPages: 2,
            fetchedItems: 1,
            elapsedMs: 20,
            degraded: false,
            usedRoutes: ['/api/members/show.json', '/member/:username/replies'],
          },
        }),
      ),
      guozaoke: new TestConnector('guozaoke', async ({ ref }) =>
        buildSnapshot(ref, {
          activities: [
            {
              id: 'beta-topic',
              community: 'guozaoke',
              handle: ref.handle,
              type: 'topic',
              url: 'https://www.guozaoke.com/t/beta',
              topicTitle: 'Beta topic',
              contentText: 'A substantive topic from beta with enough text for aggregation.',
              excerpt: 'A substantive topic from beta with enough text for aggregation.',
              publishedAt: '2026-03-21T00:00:00.000Z',
              sourceTrace: {
                route: '/u/:id/topics',
                fetchedAt: '2026-03-22T00:05:00.000Z',
                contentHash: 'hash-beta',
              },
            },
          ],
          diagnostics: {
            fetchedPages: 2,
            fetchedItems: 1,
            elapsedMs: 20,
            degraded: false,
            usedRoutes: ['/u/:id', '/u/:id/topics'],
          },
        }),
      ),
      weibo: new TestConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    };

    vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', () => ({
      StaticConnectorRegistry: class StaticConnectorRegistry {
        get(community: 'v2ex' | 'guozaoke' | 'weibo') {
          return connectors[community];
        }

        list() {
          return Object.values(connectors);
        }
      },
    }));

    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');

    const report = await runAnalyzePipeline({
      identity: {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(report.metrics.totalActivities).toBe(2);
    expect(report.communityBreakdowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ community: 'v2ex', handle: 'alpha' }),
        expect.objectContaining({ community: 'guozaoke', handle: 'beta' }),
      ]),
    );
    expect(report.warnings).toEqual([]);

    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  });

  test('can run a cross-community cluster pipeline with partial success', async () => {
    vi.resetModules();

    const connectors = {
      v2ex: new TestConnector('v2ex', async ({ ref }) =>
        buildSnapshot(ref, {
          activities: [
            {
              id: 'alpha-reply',
              community: 'v2ex',
              handle: ref.handle,
              type: 'reply',
              url: 'https://www.v2ex.com/t/alpha',
              topicTitle: 'Alpha reply',
              contentText: 'A substantive reply from alpha about architecture questions.',
              excerpt: 'A substantive reply from alpha about architecture questions.',
              publishedAt: '2026-03-22T00:00:00.000Z',
              sourceTrace: {
                route: '/member/:username/replies',
                fetchedAt: '2026-03-22T00:05:00.000Z',
                contentHash: 'hash-alpha',
              },
            },
          ],
          diagnostics: {
            fetchedPages: 2,
            fetchedItems: 1,
            elapsedMs: 20,
            degraded: false,
            usedRoutes: ['/api/members/show.json', '/member/:username/replies'],
          },
        }),
      ),
      guozaoke: new TestConnector('guozaoke', async () => {
        throw new Error('temporary upstream failure');
      }),
      weibo: new TestConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    };

    vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', () => ({
      StaticConnectorRegistry: class StaticConnectorRegistry {
        get(community: 'v2ex' | 'guozaoke' | 'weibo') {
          return connectors[community];
        }

        list() {
          return Object.values(connectors);
        }
      },
    }));

    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');

    const report = await runAnalyzePipeline({
      identity: {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(report.metrics.totalActivities).toBe(1);
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PARTIAL_RESULT',
        }),
      ]),
    );

    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  });

  test('fails explicitly when every account fetch fails', async () => {
    vi.resetModules();

    const connectors = {
      v2ex: new TestConnector('v2ex', async () => {
        throw new Error('v2ex fetch failed');
      }),
      guozaoke: new TestConnector('guozaoke', async () => {
        throw new Error('guozaoke fetch failed');
      }),
      weibo: new TestConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    };

    vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', () => ({
      StaticConnectorRegistry: class StaticConnectorRegistry {
        get(community: 'v2ex' | 'guozaoke' | 'weibo') {
          return connectors[community];
        }

        list() {
          return Object.values(connectors);
        }
      },
    }));

    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');

    await expect(
      runAnalyzePipeline({
        identity: {
          accounts: [
            { community: 'v2ex', handle: 'alpha' },
            { community: 'guozaoke', handle: 'beta' },
          ],
        },
      }),
    ).rejects.toThrow('No account snapshots could be fetched');

    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  });

  test('does not fetch duplicate accounts twice when the request repeats the same account', async () => {
    vi.resetModules();
    const fetchSpy = vi.fn(async ({ ref }: FetchSnapshotInput) =>
      buildSnapshot(ref, {
        activities: [
          {
            id: 'alpha-reply',
            community: 'v2ex',
            handle: ref.handle,
            type: 'reply',
            url: 'https://www.v2ex.com/t/alpha',
            topicTitle: 'Alpha reply',
            contentText: 'A substantive reply from alpha about architecture questions.',
            excerpt: 'A substantive reply from alpha about architecture questions.',
            publishedAt: '2026-03-22T00:00:00.000Z',
            sourceTrace: {
              route: '/member/:username/replies',
              fetchedAt: '2026-03-22T00:05:00.000Z',
              contentHash: 'hash-alpha',
            },
          },
        ],
        diagnostics: {
          fetchedPages: 2,
          fetchedItems: 1,
          elapsedMs: 20,
          degraded: false,
          usedRoutes: ['/api/members/show.json', '/member/:username/replies'],
        },
      }),
    );
    const connectors = {
      v2ex: new TestConnector('v2ex', fetchSpy),
      guozaoke: new TestConnector('guozaoke', async ({ ref }) => buildSnapshot(ref)),
      weibo: new TestConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    };

    vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', () => ({
      StaticConnectorRegistry: class StaticConnectorRegistry {
        get(community: 'v2ex' | 'guozaoke' | 'weibo') {
          return connectors[community];
        }

        list() {
          return Object.values(connectors);
        }
      },
    }));

    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');

    const report = await runAnalyzePipeline({
      identity: {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'v2ex', handle: ' alpha ' },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(report.metrics.totalActivities).toBe(1);

    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  });
});
