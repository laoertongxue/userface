import { describe, expect, test } from 'vitest';
import { V2exConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/connector';
import { AcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import { baseV2exContext, readV2exFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

type MockV2exFetcher = NonNullable<ConstructorParameters<typeof V2exConnector>[0]>['fetcher'];

async function createHappyFetcher(): Promise<NonNullable<MockV2exFetcher>> {
  const profile = JSON.parse(await readV2exFixture('member-found.json'));
  const repliesHtml = await readV2exFixture('replies-page-1.html');
  const topicsHtml = await readV2exFixture('topics-page-1.html');

  return {
    fetchMemberProfileJson: async () => ({
      data: profile,
      fetchedAt: '2026-03-22T10:00:00.000Z',
      route: '/api/members/show.json',
      url: 'https://www.v2ex.com/api/members/show.json?username=Livid',
    }),
    fetchMemberRepliesPage: async () => ({
      bodyText: repliesHtml,
      fetchedAt: '2026-03-22T10:00:00.000Z',
      page: 1,
      route: '/member/:username/replies',
      url: 'https://www.v2ex.com/member/Livid/replies?p=1',
    }),
    fetchMemberTopicsPage: async () => ({
      bodyText: topicsHtml,
      fetchedAt: '2026-03-22T10:00:00.000Z',
      page: 1,
      route: '/member/:username/topics',
      url: 'https://www.v2ex.com/member/Livid/topics?p=1',
    }),
  };
}

function createConnector(fetcher: NonNullable<MockV2exFetcher>): V2exConnector {
  return new V2exConnector({
    fetcher,
    waitForPageJitter: async () => {},
  });
}

async function fetchSnapshotWith(fetcher: NonNullable<MockV2exFetcher>) {
  return createConnector(fetcher).fetchSnapshot(
    {
      ref: {
        community: 'v2ex',
        handle: 'Livid',
      },
      window: {
        maxItems: 10,
        maxPages: 1,
      },
      include: ['profile', 'replies', 'topics'],
    },
    baseV2exContext,
  );
}

describe('V2exConnector.fetchSnapshot', () => {
  test('returns profile, activities, diagnostics, and no warnings on the happy path', async () => {
    const snapshot = await fetchSnapshotWith(await createHappyFetcher());

    expect(snapshot.profile).toMatchObject({
      community: 'v2ex',
      handle: 'Livid',
      stats: {
        replies: 30613,
        topics: 7769,
      },
    });
    expect(snapshot.activities).toHaveLength(4);
    expect(snapshot.diagnostics.fetchedPages).toBe(3);
    expect(snapshot.diagnostics.fetchedItems).toBe(snapshot.activities.length);
    expect(snapshot.diagnostics.degraded).toBe(false);
    expect(snapshot.diagnostics.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.diagnostics.usedRoutes).toEqual([
      '/api/members/show.json',
      '/member/:username/replies',
      '/member/:username/topics',
    ]);
    expect(snapshot.warnings).toEqual([]);
  });

  test('returns partial result when topics fail but replies succeed', async () => {
    const happyFetcher = await createHappyFetcher();
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchMemberTopicsPage: async () => {
        throw AcquisitionError.fromStatus(403, 'https://www.v2ex.com/member/Livid/topics?p=1');
      },
    });

    expect(snapshot.profile?.handle).toBe('Livid');
    expect(snapshot.activities.length).toBeGreaterThan(0);
    expect(snapshot.diagnostics.fetchedPages).toBe(2);
    expect(snapshot.diagnostics.degraded).toBe(true);
    expect(snapshot.diagnostics.usedRoutes).toEqual([
      '/api/members/show.json',
      '/member/:username/replies',
      '/member/:username/topics',
    ]);
    expect(snapshot.warnings.some((warning) => warning.code === 'TOPICS_HIDDEN')).toBe(true);
  });

  test('returns partial result when replies fail but topics succeed', async () => {
    const happyFetcher = await createHappyFetcher();
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchMemberRepliesPage: async () => {
        throw AcquisitionError.network('https://www.v2ex.com/member/Livid/replies?p=1');
      },
    });

    expect(snapshot.profile?.handle).toBe('Livid');
    expect(snapshot.activities.some((activity) => activity.type === 'topic')).toBe(true);
    expect(snapshot.activities.some((activity) => activity.type === 'reply')).toBe(false);
    expect(snapshot.diagnostics.fetchedPages).toBe(2);
    expect(snapshot.diagnostics.degraded).toBe(true);
    expect(snapshot.diagnostics.usedRoutes).toEqual([
      '/api/members/show.json',
      '/member/:username/replies',
      '/member/:username/topics',
    ]);
    expect(snapshot.warnings.some((warning) => warning.code === 'PARTIAL_RESULT')).toBe(true);
  });

  test('surfaces selector drift when replies parsing breaks', async () => {
    const happyFetcher = await createHappyFetcher();
    const driftHtml = await readV2exFixture('replies-page-selector-drift.html');
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchMemberRepliesPage: async () => ({
        bodyText: driftHtml,
        fetchedAt: '2026-03-22T10:00:00.000Z',
        page: 1,
        route: '/member/:username/replies',
        url: 'https://www.v2ex.com/member/Livid/replies?p=1',
      }),
    });

    expect(snapshot.activities.some((activity) => activity.type === 'topic')).toBe(true);
    expect(snapshot.activities.some((activity) => activity.type === 'reply')).toBe(false);
    expect(snapshot.diagnostics.degraded).toBe(true);
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'SELECTOR_CHANGED',
      }),
    ]);
  });

  test('surfaces selector drift when topics parsing breaks', async () => {
    const happyFetcher = await createHappyFetcher();
    const driftHtml = await readV2exFixture('topics-page-selector-drift.html');
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchMemberTopicsPage: async () => ({
        bodyText: driftHtml,
        fetchedAt: '2026-03-22T10:00:00.000Z',
        page: 1,
        route: '/member/:username/topics',
        url: 'https://www.v2ex.com/member/Livid/topics?p=1',
      }),
    });

    expect(snapshot.activities.some((activity) => activity.type === 'reply')).toBe(true);
    expect(snapshot.diagnostics.degraded).toBe(true);
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'SELECTOR_CHANGED',
      }),
    ]);
  });

  test('keeps profile success with zero activities without marking degraded when both pages are empty', async () => {
    const profile = JSON.parse(await readV2exFixture('member-found.json'));
    const emptyRepliesHtml = await readV2exFixture('replies-page-empty.html');
    const emptyTopicsHtml = await readV2exFixture('topics-page-empty.html');
    const snapshot = await fetchSnapshotWith({
      fetchMemberProfileJson: async () => ({
        data: profile,
        fetchedAt: '2026-03-22T10:00:00.000Z',
        route: '/api/members/show.json',
        url: 'https://www.v2ex.com/api/members/show.json?username=Livid',
      }),
      fetchMemberRepliesPage: async () => ({
        bodyText: emptyRepliesHtml,
        fetchedAt: '2026-03-22T10:00:00.000Z',
        page: 1,
        route: '/member/:username/replies',
        url: 'https://www.v2ex.com/member/Livid/replies?p=1',
      }),
      fetchMemberTopicsPage: async () => ({
        bodyText: emptyTopicsHtml,
        fetchedAt: '2026-03-22T10:00:00.000Z',
        page: 1,
        route: '/member/:username/topics',
        url: 'https://www.v2ex.com/member/Livid/topics?p=1',
      }),
    });

    expect(snapshot.profile?.handle).toBe('Livid');
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.diagnostics.fetchedPages).toBe(3);
    expect(snapshot.diagnostics.fetchedItems).toBe(0);
    expect(snapshot.diagnostics.degraded).toBe(false);
    expect(snapshot.warnings).toEqual([]);
  });

  test('marks RATE_LIMITED explicitly when upstream keeps rate limiting', async () => {
    const happyFetcher = await createHappyFetcher();
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchMemberRepliesPage: async () => {
        throw AcquisitionError.fromStatus(429, 'https://www.v2ex.com/member/Livid/replies?p=1');
      },
    });

    expect(snapshot.diagnostics.degraded).toBe(true);
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'RATE_LIMITED',
      }),
    ]);
    expect(snapshot.warnings.some((warning) => warning.code === 'NOT_FOUND')).toBe(false);
  });

  test('returns NOT_FOUND and stops early when profile lookup says the member does not exist', async () => {
    const profile = JSON.parse(await readV2exFixture('member-not-found.json'));
    const snapshot = await fetchSnapshotWith({
      fetchMemberProfileJson: async () => ({
        data: profile,
        fetchedAt: '2026-03-22T10:00:00.000Z',
        route: '/api/members/show.json',
        url: 'https://www.v2ex.com/api/members/show.json?username=missing',
      }),
      fetchMemberRepliesPage: async () => {
        throw new Error('should not fetch replies after profile not-found');
      },
      fetchMemberTopicsPage: async () => {
        throw new Error('should not fetch topics after profile not-found');
      },
    });

    expect(snapshot.profile).toBeNull();
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 0,
      fetchedItems: 0,
      degraded: true,
      usedRoutes: ['/api/members/show.json'],
    });
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'NOT_FOUND',
      }),
    ]);
  });
});
