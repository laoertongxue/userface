import { describe, expect, test } from 'vitest';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { FetchIdentityClusterSnapshotsResult } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import { ClusterSnapshotMergeService } from '@/src/contexts/portrait-analysis/domain/services/ClusterSnapshotMergeService';

describe('ClusterSnapshotMergeService', () => {
  test('merges successful snapshots and preserves failed account warnings', () => {
    const cluster = createIdentityCluster({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'beta' },
      ],
      links: [
        {
          from: { community: 'v2ex', handle: 'alpha' },
          to: { community: 'guozaoke', handle: 'beta' },
          source: 'USER_ASSERTED',
        },
      ],
      mode: 'MANUAL_CLUSTER',
      now: '2026-03-22T00:00:00.000Z',
    });

    const fetchResult: FetchIdentityClusterSnapshotsResult = {
      identityCluster: cluster,
      successfulSnapshots: [
        {
          account: { community: 'v2ex', handle: 'alpha' },
          snapshot: {
            ref: { community: 'v2ex', handle: 'alpha' },
            profile: {
              community: 'v2ex',
              handle: 'alpha',
              displayName: 'alpha',
              stats: {},
            },
            activities: [
              {
                id: 'a1',
                community: 'v2ex',
                handle: 'alpha',
                type: 'reply',
                url: 'https://www.v2ex.com/t/1',
                contentText: 'Reply from alpha',
                excerpt: 'Reply from alpha',
                publishedAt: '2026-03-22T00:00:00.000Z',
                sourceTrace: {
                  route: '/member/:username/replies',
                  fetchedAt: '2026-03-22T00:05:00.000Z',
                  contentHash: 'hash-a1',
                },
              },
            ],
            diagnostics: {
              fetchedPages: 2,
              fetchedItems: 1,
              elapsedMs: 10,
              degraded: false,
              usedRoutes: ['/api/members/show.json', '/member/:username/replies'],
            },
            warnings: [],
          },
        },
      ],
      failedAccounts: [
        {
          account: { community: 'guozaoke', handle: 'beta' },
          code: 'PARTIAL_RESULT',
          message: 'Failed to fetch guozaoke:beta for cluster analysis.',
        },
      ],
      totalAccounts: 2,
      successfulCount: 1,
      failedCount: 1,
      degraded: true,
    };

    const result = new ClusterSnapshotMergeService().merge(fetchResult);

    expect(result.mergedActivities).toHaveLength(1);
    expect(result.successfulAccountCount).toBe(1);
    expect(result.failedAccountCount).toBe(1);
    expect(result.degraded).toBe(true);
    expect(result.activeCommunities).toEqual(['v2ex']);
    expect(result.perAccountProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: expect.objectContaining({ handle: 'alpha' }),
          profile: expect.objectContaining({ handle: 'alpha' }),
        }),
        expect.objectContaining({
          account: expect.objectContaining({ handle: 'beta' }),
          profile: null,
        }),
      ]),
    );
    expect(result.clusterWarnings).toEqual([
      {
        code: 'PARTIAL_RESULT',
        message: 'Failed to fetch guozaoke:beta for cluster analysis.',
      },
    ]);
  });
});
