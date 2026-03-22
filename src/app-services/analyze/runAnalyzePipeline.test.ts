import { describe, expect, test, vi } from 'vitest';
import {
  readGuozaokeFixture,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';

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
});
