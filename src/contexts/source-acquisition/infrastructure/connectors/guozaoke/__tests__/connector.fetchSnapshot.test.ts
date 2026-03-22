import { describe, expect, test } from 'vitest';
import { AcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import { GuozaokeConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/connector';
import {
  baseGuozaokeContext,
  guozaokeFetchedAt,
  readGuozaokeFixture,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';

type MockGuozaokeFetcher = NonNullable<ConstructorParameters<typeof GuozaokeConnector>[0]>['fetcher'];

async function createHappyFetcher(): Promise<NonNullable<MockGuozaokeFetcher>> {
  const profileHtml = await readGuozaokeFixture('user-page.html');
  const repliesHtml = await readGuozaokeFixture('replies-page-1.html');
  const topicsHtml = await readGuozaokeFixture('topics-page-1.html');

  return {
    fetchUserProfilePage: async () => ({
      bodyText: profileHtml,
      fetchedAt: guozaokeFetchedAt,
      route: '/u/:id',
      url: 'https://www.guozaoke.com/u/sample-user',
    }),
    fetchUserRepliesPage: async () => ({
      bodyText: repliesHtml,
      fetchedAt: guozaokeFetchedAt,
      page: 1,
      route: '/u/:id/replies',
      url: 'https://www.guozaoke.com/u/sample-user/replies?p=1',
    }),
    fetchUserTopicsPage: async () => ({
      bodyText: topicsHtml,
      fetchedAt: guozaokeFetchedAt,
      page: 1,
      route: '/u/:id/topics',
      url: 'https://www.guozaoke.com/u/sample-user/topics?p=1',
    }),
  };
}

function createConnector(fetcher: NonNullable<MockGuozaokeFetcher>): GuozaokeConnector {
  return new GuozaokeConnector({
    fetcher,
    waitForPageJitter: async () => {},
  });
}

async function fetchSnapshotWith(fetcher: NonNullable<MockGuozaokeFetcher>) {
  return createConnector(fetcher).fetchSnapshot(
    {
      ref: {
        community: 'guozaoke',
        handle: 'sample-user',
      },
      window: {
        maxItems: 10,
        maxPages: 1,
      },
      include: ['profile', 'replies', 'topics'],
    },
    baseGuozaokeContext,
  );
}

describe('GuozaokeConnector.fetchSnapshot', () => {
  test('returns profile, activities, diagnostics, and no warnings on the happy path', async () => {
    const snapshot = await fetchSnapshotWith(await createHappyFetcher());

    expect(snapshot.profile).toMatchObject({
      community: 'guozaoke',
      handle: 'sample-user',
      displayName: '示例用户',
      stats: {
        favorites: 2,
        replies: 12,
        topics: 8,
      },
    });
    expect(snapshot.activities).toHaveLength(4);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 3,
      fetchedItems: 4,
      degraded: false,
      usedRoutes: ['/u/:id', '/u/:id/replies', '/u/:id/topics'],
    });
    expect(snapshot.diagnostics.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.warnings).toEqual([]);
  });

  test('returns partial result when topics drift but replies succeed', async () => {
    const happyFetcher = await createHappyFetcher();
    const driftHtml = await readGuozaokeFixture('topics-selector-drift.html');
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchUserTopicsPage: async () => ({
        bodyText: driftHtml,
        fetchedAt: guozaokeFetchedAt,
        page: 1,
        route: '/u/:id/topics',
        url: 'https://www.guozaoke.com/u/sample-user/topics?p=1',
      }),
    });

    expect(snapshot.profile?.handle).toBe('sample-user');
    expect(snapshot.activities.some((activity) => activity.type === 'reply')).toBe(true);
    expect(snapshot.activities.some((activity) => activity.type === 'topic')).toBe(false);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 2,
      fetchedItems: snapshot.activities.length,
      degraded: true,
      usedRoutes: ['/u/:id', '/u/:id/replies', '/u/:id/topics'],
    });
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'SELECTOR_CHANGED',
        message:
          'Guozaoke topics selector mismatch for "sample-user": expected topic items were not found.',
      }),
    ]);
  });

  test('returns partial result when replies drift but topics succeed', async () => {
    const happyFetcher = await createHappyFetcher();
    const driftHtml = await readGuozaokeFixture('replies-selector-drift.html');
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchUserRepliesPage: async () => ({
        bodyText: driftHtml,
        fetchedAt: guozaokeFetchedAt,
        page: 1,
        route: '/u/:id/replies',
        url: 'https://www.guozaoke.com/u/sample-user/replies?p=1',
      }),
    });

    expect(snapshot.profile?.handle).toBe('sample-user');
    expect(snapshot.activities.some((activity) => activity.type === 'topic')).toBe(true);
    expect(snapshot.activities.some((activity) => activity.type === 'reply')).toBe(false);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 2,
      fetchedItems: snapshot.activities.length,
      degraded: true,
      usedRoutes: ['/u/:id', '/u/:id/replies', '/u/:id/topics'],
    });
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'SELECTOR_CHANGED',
        message:
          'Guozaoke replies selector mismatch for "sample-user": expected reply items were not found.',
      }),
    ]);
  });

  test('returns profile with degraded=true when replies and topics both fail', async () => {
    const happyFetcher = await createHappyFetcher();
    const repliesDrift = await readGuozaokeFixture('replies-selector-drift.html');
    const topicsDrift = await readGuozaokeFixture('topics-selector-drift.html');
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchUserRepliesPage: async () => ({
        bodyText: repliesDrift,
        fetchedAt: guozaokeFetchedAt,
        page: 1,
        route: '/u/:id/replies',
        url: 'https://www.guozaoke.com/u/sample-user/replies?p=1',
      }),
      fetchUserTopicsPage: async () => ({
        bodyText: topicsDrift,
        fetchedAt: guozaokeFetchedAt,
        page: 1,
        route: '/u/:id/topics',
        url: 'https://www.guozaoke.com/u/sample-user/topics?p=1',
      }),
    });

    expect(snapshot.profile?.handle).toBe('sample-user');
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 1,
      fetchedItems: 0,
      degraded: true,
      usedRoutes: ['/u/:id', '/u/:id/replies', '/u/:id/topics'],
    });
    expect(snapshot.warnings).toHaveLength(2);
    expect(snapshot.warnings.map((warning) => warning.code)).toEqual([
      'SELECTOR_CHANGED',
      'SELECTOR_CHANGED',
    ]);
  });

  test('stops early with NOT_FOUND when the profile page is missing', async () => {
    const profileHtml = await readGuozaokeFixture('user-not-found.html');
    const snapshot = await fetchSnapshotWith({
      fetchUserProfilePage: async () => ({
        bodyText: profileHtml,
        fetchedAt: guozaokeFetchedAt,
        route: '/u/:id',
        url: 'https://www.guozaoke.com/u/missing-user',
      }),
      fetchUserRepliesPage: async () => {
        throw new Error('should not fetch replies after profile not-found');
      },
      fetchUserTopicsPage: async () => {
        throw new Error('should not fetch topics after profile not-found');
      },
    });

    expect(snapshot.profile).toBeNull();
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 0,
      fetchedItems: 0,
      degraded: true,
      usedRoutes: ['/u/:id'],
    });
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'Guozaoke user "sample-user" was not found.',
      }),
    ]);
  });

  test('keeps explicit empty replies/topics as a successful non-degraded result', async () => {
    const happyFetcher = await createHappyFetcher();
    const emptyReplies = await readGuozaokeFixture('replies-empty.html');
    const emptyTopics = await readGuozaokeFixture('topics-empty.html');
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchUserRepliesPage: async () => ({
        bodyText: emptyReplies,
        fetchedAt: guozaokeFetchedAt,
        page: 1,
        route: '/u/:id/replies',
        url: 'https://www.guozaoke.com/u/empty-user/replies?p=1',
      }),
      fetchUserTopicsPage: async () => ({
        bodyText: emptyTopics,
        fetchedAt: guozaokeFetchedAt,
        page: 1,
        route: '/u/:id/topics',
        url: 'https://www.guozaoke.com/u/empty-user/topics?p=1',
      }),
    });

    expect(snapshot.profile?.handle).toBe('sample-user');
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject({
      fetchedPages: 3,
      fetchedItems: 0,
      degraded: false,
    });
    expect(snapshot.warnings).toEqual([]);
  });

  test('marks RATE_LIMITED explicitly when upstream keeps rate limiting', async () => {
    const happyFetcher = await createHappyFetcher();
    const snapshot = await fetchSnapshotWith({
      ...happyFetcher,
      fetchUserRepliesPage: async () => {
        throw AcquisitionError.fromStatus(
          429,
          'https://www.guozaoke.com/u/sample-user/replies?p=1',
        );
      },
    });

    expect(snapshot.diagnostics.degraded).toBe(true);
    expect(snapshot.warnings).toMatchObject([
      expect.objectContaining({
        code: 'RATE_LIMITED',
        message:
          'Guozaoke rate limited replies retrieval for "sample-user" and the connector could not recover.',
      }),
    ]);
    expect(snapshot.warnings.some((warning) => warning.code === 'NOT_FOUND')).toBe(false);
  });
});
