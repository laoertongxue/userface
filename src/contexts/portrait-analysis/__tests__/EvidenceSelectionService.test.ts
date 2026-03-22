import { describe, expect, test } from 'vitest';
import type { CanonicalActivity } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import { EvidenceSelectionService } from '@/src/contexts/portrait-analysis/domain/services/EvidenceSelectionService';

function activity(overrides: Partial<CanonicalActivity>): CanonicalActivity {
  return {
    id: overrides.id ?? 'activity',
    community: overrides.community ?? 'v2ex',
    handle: overrides.handle ?? 'sample-user',
    type: overrides.type ?? 'reply',
    url: overrides.url ?? 'https://example.com/t/1',
    topicTitle: overrides.topicTitle ?? 'Topic',
    nodeName: overrides.nodeName,
    contentText: overrides.contentText ?? 'Default substantive content for evidence selection.',
    excerpt: overrides.excerpt ?? 'Default substantive content for evidence selection.',
    publishedAt: overrides.publishedAt ?? '2026-03-20T00:00:00.000Z',
    sourceTrace: overrides.sourceTrace ?? {
      route: '/route',
      fetchedAt: '2026-03-20T00:00:00.000Z',
      contentHash: 'hash',
    },
    stats: overrides.stats,
    topicId: overrides.topicId,
  };
}

const featureVector: FeatureVector = {
  activity: {
    totalActivities: 6,
    topicCount: 3,
    replyCount: 3,
    topicRatio: 0.5,
    replyRatio: 0.5,
    activeDays: 3,
    activeSpanDays: 5,
    avgActivitiesPerActiveDay: 2,
    firstActivityAt: '2026-03-18T00:00:00.000Z',
    lastActivityAt: '2026-03-22T00:00:00.000Z',
    activeCommunities: ['guozaoke', 'v2ex'],
    activeCommunityCount: 2,
  },
  content: {
    avgTextLength: 80,
    nonEmptyContentRatio: 1,
    longFormRatio: 0.2,
    questionRatio: 0.2,
    linkRatio: 0.2,
    substantiveTextRatio: 1,
  },
  topic: {
    dominantTopics: [],
    dominantNodes: [],
    uniqueNodeCount: 2,
    topicConcentration: 0.4,
    diversityScore: 0.5,
    nodeCoverageRatio: 0.8,
  },
  community: {
    communityActivityShare: {
      v2ex: 0.5,
      guozaoke: 0.5,
    },
    perCommunityMetrics: {},
    crossCommunity: true,
  },
  dataQuality: {
    degraded: false,
    evidenceDensity: 1,
    sufficientData: true,
    qualityFlags: [],
  },
};

describe('EvidenceSelectionService', () => {
  test('selects evidence within the cap and always attaches reasons', () => {
    const result = new EvidenceSelectionService().select({
      activities: [
        activity({ id: 'a1', type: 'topic', community: 'v2ex' }),
        activity({ id: 'a2', type: 'reply', community: 'v2ex' }),
        activity({ id: 'a3', type: 'topic', community: 'guozaoke' }),
        activity({ id: 'a4', type: 'reply', community: 'guozaoke' }),
        activity({ id: 'a5', type: 'topic', community: 'v2ex' }),
        activity({ id: 'a6', type: 'reply', community: 'guozaoke' }),
      ],
      featureVector,
    });

    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.selected.length).toBeLessThanOrEqual(5);
    expect(result.selected.every((candidate) => candidate.reasons.length > 0)).toBe(true);
  });

  test('dedupes repeated activity ids, excerpts, and url/text duplicates', () => {
    const result = new EvidenceSelectionService().select({
      activities: [
        activity({
          id: 'dup-1',
          url: 'https://example.com/t/1',
          contentText: 'Repeated substantive evidence block.',
          excerpt: 'Repeated substantive evidence block.',
        }),
        activity({
          id: 'dup-1',
          url: 'https://example.com/t/1',
          contentText: 'Repeated substantive evidence block.',
          excerpt: 'Repeated substantive evidence block.',
        }),
        activity({
          id: 'dup-2',
          url: 'https://example.com/t/1',
          contentText: 'Repeated substantive evidence block.',
          excerpt: 'Repeated substantive evidence block.',
        }),
        activity({
          id: 'unique',
          url: 'https://example.com/t/2',
          contentText: 'A different substantive evidence block for contrast.',
          excerpt: 'A different substantive evidence block for contrast.',
        }),
      ],
      featureVector,
    });

    expect(result.stats.totalCandidates).toBe(4);
    expect(result.stats.dedupedCount).toBeGreaterThanOrEqual(2);
    expect(new Set(result.selected.map((candidate) => candidate.activityId)).size).toBe(
      result.selected.length,
    );
  });

  test('prefers type and community diversity when the data allows it', () => {
    const result = new EvidenceSelectionService().select({
      activities: [
        activity({
          id: 'v-topic',
          type: 'topic',
          community: 'v2ex',
          url: 'https://example.com/t/1',
          contentText: 'V2EX topic evidence with architecture context.',
          excerpt: 'V2EX topic evidence with architecture context.',
        }),
        activity({
          id: 'v-reply',
          type: 'reply',
          community: 'v2ex',
          url: 'https://example.com/t/2',
          contentText: 'V2EX reply evidence with troubleshooting detail.',
          excerpt: 'V2EX reply evidence with troubleshooting detail.',
        }),
        activity({
          id: 'g-topic',
          type: 'topic',
          community: 'guozaoke',
          url: 'https://example.com/t/3',
          contentText: 'Guozaoke topic evidence with community coverage.',
          excerpt: 'Guozaoke topic evidence with community coverage.',
        }),
        activity({
          id: 'g-reply',
          type: 'reply',
          community: 'guozaoke',
          url: 'https://example.com/t/4',
          contentText: 'Guozaoke reply evidence with community coverage.',
          excerpt: 'Guozaoke reply evidence with community coverage.',
        }),
      ],
      featureVector,
    });

    expect(result.stats.topicEvidenceCount).toBeGreaterThan(0);
    expect(result.stats.replyEvidenceCount).toBeGreaterThan(0);
    expect(result.stats.communityCoverage).toEqual(
      expect.arrayContaining(['v2ex', 'guozaoke']),
    );
  });
});
