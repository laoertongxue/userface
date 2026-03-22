import { describe, expect, test } from 'vitest';
import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { EvidenceSelectionResult } from '@/src/contexts/portrait-analysis/application/dto/EvidenceSelectionResult';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import { ConfidenceScoringService } from '@/src/contexts/portrait-analysis/domain/services/ConfidenceScoringService';

function featureVector(overrides: {
  activity?: Partial<FeatureVector['activity']>;
  content?: Partial<FeatureVector['content']>;
  topic?: Partial<FeatureVector['topic']>;
  community?: Partial<FeatureVector['community']>;
  dataQuality?: Partial<FeatureVector['dataQuality']>;
}): FeatureVector {
  return {
    activity: {
      totalActivities: 10,
      topicCount: 5,
      replyCount: 5,
      topicRatio: 0.5,
      replyRatio: 0.5,
      activeDays: 4,
      activeSpanDays: 10,
      avgActivitiesPerActiveDay: 2.5,
      firstActivityAt: '2026-03-10T00:00:00.000Z',
      lastActivityAt: '2026-03-20T00:00:00.000Z',
      activeCommunities: ['v2ex'],
      activeCommunityCount: 1,
      ...(overrides.activity ?? {}),
    },
    content: {
      avgTextLength: 90,
      nonEmptyContentRatio: 1,
      longFormRatio: 0.2,
      questionRatio: 0.2,
      linkRatio: 0.1,
      substantiveTextRatio: 0.8,
      ...(overrides.content ?? {}),
    },
    topic: {
      dominantTopics: [],
      dominantNodes: [],
      uniqueNodeCount: 2,
      topicConcentration: 0.4,
      diversityScore: 0.5,
      nodeCoverageRatio: 0.8,
      ...(overrides.topic ?? {}),
    },
    community: {
      communityActivityShare: {
        v2ex: 1,
      },
      perCommunityMetrics: {},
      crossCommunity: false,
      ...(overrides.community ?? {}),
    },
    dataQuality: {
      degraded: false,
      evidenceDensity: 0.8,
      sufficientData: true,
      qualityFlags: [],
      ...(overrides.dataQuality ?? {}),
    },
  };
}

function evidenceSelection(
  overrides: Partial<EvidenceSelectionResult>,
): EvidenceSelectionResult {
  return {
    candidates: overrides.candidates ?? [
      {
        id: 'e1',
        activityId: 'a1',
        community: 'v2ex',
        activityType: 'topic',
        labelHint: 'Representative topic',
        excerpt: 'Topic evidence',
        activityUrl: 'https://example.com/t/1',
        publishedAt: '2026-03-20T00:00:00.000Z',
        reasons: ['substantive-text'],
      },
      {
        id: 'e2',
        activityId: 'a2',
        community: 'v2ex',
        activityType: 'reply',
        labelHint: 'Representative reply',
        excerpt: 'Reply evidence',
        activityUrl: 'https://example.com/t/2',
        publishedAt: '2026-03-19T00:00:00.000Z',
        reasons: ['substantive-text'],
      },
    ],
    selected: overrides.selected ?? [
      {
        id: 'e1',
        activityId: 'a1',
        community: 'v2ex',
        activityType: 'topic',
        labelHint: 'Representative topic',
        excerpt: 'Topic evidence',
        activityUrl: 'https://example.com/t/1',
        publishedAt: '2026-03-20T00:00:00.000Z',
        reasons: ['substantive-text'],
      },
      {
        id: 'e2',
        activityId: 'a2',
        community: 'v2ex',
        activityType: 'reply',
        labelHint: 'Representative reply',
        excerpt: 'Reply evidence',
        activityUrl: 'https://example.com/t/2',
        publishedAt: '2026-03-19T00:00:00.000Z',
        reasons: ['substantive-text'],
      },
    ],
    stats: {
      totalCandidates: 2,
      selectedCount: 2,
      topicEvidenceCount: 1,
      replyEvidenceCount: 1,
      communityCoverage: ['v2ex'],
      dedupedCount: 0,
      ...overrides.stats,
    },
  };
}

describe('ConfidenceScoringService', () => {
  test('returns lower confidence for low-data samples', () => {
    const profile = new ConfidenceScoringService().score({
      featureVector: featureVector({
        activity: {
          totalActivities: 2,
          activeDays: 1,
          activeSpanDays: 1,
        },
        dataQuality: {
          degraded: false,
          evidenceDensity: 0.2,
          sufficientData: false,
          qualityFlags: ['LOW_ACTIVITY_VOLUME', 'LOW_ACTIVE_DAYS', 'LOW_TEXT_DENSITY'],
        },
        content: {
          avgTextLength: 12,
          substantiveTextRatio: 0.2,
        },
      }),
      evidenceSelection: evidenceSelection({
        selected: [
          {
            id: 'e1',
            activityId: 'a1',
            community: 'v2ex',
            activityType: 'topic',
            labelHint: 'Representative topic',
            excerpt: 'Topic evidence',
            activityUrl: 'https://example.com/t/1',
            publishedAt: '2026-03-20T00:00:00.000Z',
            reasons: ['substantive-text'],
          },
        ],
        stats: {
          selectedCount: 1,
          topicEvidenceCount: 1,
          replyEvidenceCount: 0,
          communityCoverage: ['v2ex'],
        } as EvidenceSelectionResult['stats'],
      }),
    });

    expect(profile.overall).toBeLessThan(0.5);
    expect(profile.flags).toEqual(
      expect.arrayContaining([
        'LOW_ACTIVITY_VOLUME',
        'LOW_ACTIVE_DAYS',
        'LOW_TEXT_DENSITY',
        'LOW_EVIDENCE_COVERAGE',
      ]),
    );
  });

  test('penalizes degraded sources compared with equivalent non-degraded samples', () => {
    const service = new ConfidenceScoringService();
    const strongVector = featureVector({});
    const strongEvidence = evidenceSelection({
      stats: {
        totalCandidates: 4,
        selectedCount: 3,
        topicEvidenceCount: 2,
        replyEvidenceCount: 1,
        communityCoverage: ['v2ex'],
        dedupedCount: 0,
      },
    });

    const clean = service.score({
      featureVector: strongVector,
      evidenceSelection: strongEvidence,
    });
    const degraded = service.score({
      featureVector: featureVector({
        dataQuality: {
          degraded: true,
          evidenceDensity: 0.8,
          sufficientData: true,
          qualityFlags: ['DEGRADED_SOURCE'],
        },
      }),
      evidenceSelection: strongEvidence,
    });

    expect(degraded.overall).toBeLessThan(clean.overall);
    expect(degraded.flags).toContain('DEGRADED_SOURCE');
  });

  test('rewards stronger evidence and wider activity basis over weaker samples', () => {
    const service = new ConfidenceScoringService();
    const weak = service.score({
      featureVector: featureVector({
        activity: {
          totalActivities: 4,
          activeDays: 2,
          activeSpanDays: 2,
        },
        dataQuality: {
          degraded: false,
          evidenceDensity: 0.4,
          sufficientData: false,
          qualityFlags: ['LOW_ACTIVITY_VOLUME', 'LOW_ACTIVE_DAYS', 'LOW_TEXT_DENSITY'],
        },
      }),
      evidenceSelection: evidenceSelection({
        stats: {
          totalCandidates: 2,
          selectedCount: 1,
          topicEvidenceCount: 1,
          replyEvidenceCount: 0,
          communityCoverage: ['v2ex'],
          dedupedCount: 0,
        },
      }),
    });
    const strong = service.score({
      featureVector: featureVector({
        activity: {
          totalActivities: 18,
          activeDays: 6,
          activeSpanDays: 14,
          activeCommunities: ['guozaoke', 'v2ex'],
          activeCommunityCount: 2,
        },
        community: {
          communityActivityShare: {
            v2ex: 0.5,
            guozaoke: 0.5,
          },
          perCommunityMetrics: {},
          crossCommunity: true,
        },
      }),
      evidenceSelection: evidenceSelection({
        candidates: [
          ...evidenceSelection({}).candidates,
          {
            id: 'e3',
            activityId: 'a3',
            community: 'guozaoke',
            activityType: 'reply',
            labelHint: 'Representative reply',
            excerpt: 'Cross-community reply evidence',
            activityUrl: 'https://example.com/t/3',
            publishedAt: '2026-03-18T00:00:00.000Z',
            reasons: ['community-coverage'],
          },
        ],
        selected: [
          ...evidenceSelection({}).selected,
          {
            id: 'e3',
            activityId: 'a3',
            community: 'guozaoke',
            activityType: 'reply',
            labelHint: 'Representative reply',
            excerpt: 'Cross-community reply evidence',
            activityUrl: 'https://example.com/t/3',
            publishedAt: '2026-03-18T00:00:00.000Z',
            reasons: ['community-coverage'],
          },
        ],
        stats: {
          totalCandidates: 3,
          selectedCount: 3,
          topicEvidenceCount: 1,
          replyEvidenceCount: 2,
          communityCoverage: ['v2ex', 'guozaoke'],
          dedupedCount: 0,
        },
      }),
    });

    expect(strong.overall).toBeGreaterThan(weak.overall);
    expect(strong.flags).toContain('CROSS_COMMUNITY_STRONGER_BASIS');
  });
});
