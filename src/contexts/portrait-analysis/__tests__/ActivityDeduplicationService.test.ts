import { describe, expect, test } from 'vitest';
import { ActivityDeduplicationService } from '@/src/contexts/portrait-analysis/domain/services/ActivityDeduplicationService';
import type { CanonicalActivity } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

function buildActivity(overrides: Partial<CanonicalActivity> = {}): CanonicalActivity {
  return {
    id: 'activity-1',
    community: 'v2ex',
    handle: 'alpha',
    type: 'reply',
    url: 'https://www.v2ex.com/t/1',
    contentText: 'A representative reply',
    excerpt: 'A representative reply',
    publishedAt: '2026-03-22T00:00:00.000Z',
    sourceTrace: {
      route: '/member/:username/replies',
      fetchedAt: '2026-03-22T00:05:00.000Z',
      contentHash: 'hash-1',
    },
    ...overrides,
  };
}

describe('ActivityDeduplicationService', () => {
  test('dedupes activities by stable identity and keeps ordering stable', () => {
    const activities = [
      buildActivity({
        id: 'activity-older',
        url: 'https://www.v2ex.com/t/older',
        publishedAt: '2026-03-20T00:00:00.000Z',
      }),
      buildActivity(),
      buildActivity({
        id: 'activity-1',
        contentText: 'A representative reply with more detail and node context.',
        excerpt: 'A representative reply',
        nodeName: 'architecture',
      }),
      buildActivity({
        id: 'activity-2',
        url: 'https://www.v2ex.com/t/1',
      }),
    ];

    const result = new ActivityDeduplicationService().dedupe(activities);

    expect(result.dedupedActivities).toHaveLength(2);
    expect(result.removedCount).toBe(2);
    expect(result.dedupedActivities[0]).toMatchObject({
      id: 'activity-1',
      nodeName: 'architecture',
    });
    expect(result.dedupeReasons.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining(['ACTIVITY_ID', 'COMMUNITY_URL_TYPE']),
    );
  });
});
