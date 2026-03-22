import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';

export function makeFeatureVector(overrides: {
  activity?: Partial<FeatureVector['activity']>;
  content?: Partial<FeatureVector['content']>;
  topic?: Partial<FeatureVector['topic']>;
  community?: Partial<FeatureVector['community']>;
  dataQuality?: Partial<FeatureVector['dataQuality']>;
} = {}): FeatureVector {
  return {
    activity: {
      totalActivities: 12,
      topicCount: 6,
      replyCount: 6,
      topicRatio: 0.5,
      replyRatio: 0.5,
      activeDays: 5,
      activeSpanDays: 10,
      avgActivitiesPerActiveDay: 2.4,
      firstActivityAt: '2026-03-10T00:00:00.000Z',
      lastActivityAt: '2026-03-20T00:00:00.000Z',
      activeCommunities: ['v2ex'],
      activeCommunityCount: 1,
      ...(overrides.activity ?? {}),
    },
    content: {
      avgTextLength: 120,
      nonEmptyContentRatio: 1,
      longFormRatio: 0.2,
      questionRatio: 0.15,
      linkRatio: 0.05,
      substantiveTextRatio: 0.85,
      ...(overrides.content ?? {}),
    },
    topic: {
      dominantTopics: [],
      dominantNodes: [],
      uniqueNodeCount: 3,
      topicConcentration: 0.45,
      diversityScore: 0.4,
      nodeCoverageRatio: 0.75,
      ...(overrides.topic ?? {}),
    },
    community: {
      communityActivityShare: {
        v2ex: 1,
      },
      perCommunityMetrics: {
        'v2ex:alpha': {
          community: 'v2ex',
          handle: 'alpha',
          totalActivities: 12,
          topicCount: 6,
          replyCount: 6,
          activeDays: 5,
          avgTextLength: 120,
          longFormRatio: 0.2,
          questionRatio: 0.15,
          linkRatio: 0.05,
        },
      },
      crossCommunity: false,
      ...(overrides.community ?? {}),
    },
    dataQuality: {
      degraded: false,
      evidenceDensity: 0.85,
      sufficientData: true,
      qualityFlags: [],
      ...(overrides.dataQuality ?? {}),
    },
  };
}

export function makeConfidenceProfile(
  overrides: Partial<ConfidenceProfile> = {},
): ConfidenceProfile {
  return {
    overall: 0.72,
    dataVolume: 0.72,
    activitySpan: 0.68,
    textQuality: 0.74,
    sourceQuality: 0.95,
    coverage: 0.7,
    flags: [],
    reasons: ['adequate-data-volume'],
    ...overrides,
  };
}

export function makeEvidenceCandidate(
  overrides: Partial<EvidenceCandidate> = {},
): EvidenceCandidate {
  return {
    id: overrides.id ?? 'e1',
    activityId: overrides.activityId ?? 'a1',
    community: overrides.community ?? 'v2ex',
    activityType: overrides.activityType ?? 'reply',
    labelHint: overrides.labelHint ?? 'Representative reply',
    excerpt: overrides.excerpt ?? 'Representative evidence excerpt with enough substance.',
    activityUrl: overrides.activityUrl ?? 'https://example.com/t/1',
    publishedAt: overrides.publishedAt ?? '2026-03-20T00:00:00.000Z',
    reasons: overrides.reasons ?? ['substantive-text'],
    nodeName: overrides.nodeName,
    score: overrides.score,
    textLength: overrides.textLength ?? 80,
  };
}

export function makeSignal(overrides: Partial<Signal>): Signal {
  return {
    code: overrides.code ?? 'DISCUSSION_HEAVY',
    score: overrides.score ?? 0.7,
    rationale: overrides.rationale ?? 'Signal rationale.',
    supportingEvidenceIds: overrides.supportingEvidenceIds ?? ['e1'],
    communityScope: overrides.communityScope ?? 'global',
  };
}
