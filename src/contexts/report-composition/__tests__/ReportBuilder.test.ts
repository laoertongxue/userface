import { describe, expect, test } from 'vitest';
import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import { ReportBuilder } from '@/src/contexts/report-composition/domain/services/ReportBuilder';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';

function reportInput(overrides: Partial<ComposePortraitReportInput> = {}): ComposePortraitReportInput {
  return {
    archetype: overrides.archetype ?? 'DISCUSSION_ORIENTED',
    confidenceProfile: overrides.confidenceProfile ?? makeConfidenceProfile(),
    evidenceCandidates:
      overrides.evidenceCandidates ??
      [
        makeEvidenceCandidate({
          id: 'e1',
          activityId: 'a1',
          activityType: 'reply',
          excerpt: 'A representative reply with enough detail to be useful in the report.',
          activityUrl: 'https://example.com/t/1',
          reasons: ['substantive-text', 'type-balance'],
        }),
      ],
    featureVector: overrides.featureVector ?? makeFeatureVector(),
    primaryArchetype: overrides.primaryArchetype ?? {
      code: 'DISCUSSION_ORIENTED',
      score: 0.72,
      rationale: 'Replies are a strong and sustained pattern in the sample.',
      supportingSignalCodes: ['DISCUSSION_HEAVY'],
    },
    selectedEvidence:
      overrides.selectedEvidence ??
      [
        makeEvidenceCandidate({
          id: 'e1',
          activityId: 'a1',
          activityType: 'reply',
          excerpt: 'A representative reply with enough detail to be useful in the report.',
          activityUrl: 'https://example.com/t/1',
          reasons: ['substantive-text', 'type-balance'],
        }),
        makeEvidenceCandidate({
          id: 'e2',
          activityId: 'a2',
          activityType: 'topic',
          activityUrl: 'https://example.com/t/2',
          excerpt: 'A representative topic with broader context for the report output.',
          reasons: ['community-coverage'],
        }),
      ],
    signals:
      overrides.signals ??
      [
        makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.78 }),
        makeSignal({ code: 'HIGH_OUTPUT', score: 0.66 }),
      ],
    synthesisResult: overrides.synthesisResult ?? {
      stableTraits: ['DISCUSSION_HEAVY', 'HIGH_OUTPUT'],
      communityInsights: [
        {
          community: 'v2ex',
          handle: 'alpha',
          dominantTraits: ['DISCUSSION_HEAVY', 'HIGH_OUTPUT'],
          summaryHint: 'Observed 12 activities on v2ex with a reply-led pattern.',
          confidenceModifier: 0.74,
        },
      ],
    },
    tags:
      overrides.tags ??
      [
        {
          code: 'DISCUSSION_HEAVY',
          displayName: 'discussion-heavy',
          summaryHint: 'Reply activity is a primary participation pattern.',
          supportingSignalCodes: ['DISCUSSION_HEAVY'],
        },
        {
          code: 'HIGH_OUTPUT',
          displayName: 'high-output',
          summaryHint: 'The current sample shows comparatively high activity volume.',
          supportingSignalCodes: ['HIGH_OUTPUT'],
        },
      ],
    warnings: overrides.warnings ?? [],
  };
}

describe('ReportBuilder', () => {
  test('builds a complete PortraitReport on the happy path', () => {
    const report = new ReportBuilder().build(reportInput());

    expect(report).toMatchObject({
      portrait: {
        archetype: 'discussion-oriented',
        tags: ['discussion-heavy', 'high-output'],
        summary: expect.any(String),
        confidence: 0.72,
      },
      evidence: expect.arrayContaining([
        expect.objectContaining({
          label: expect.any(String),
          excerpt: expect.any(String),
          activityUrl: expect.any(String),
          community: expect.any(String),
          publishedAt: expect.any(String),
        }),
      ]),
      metrics: {
        totalActivities: 12,
        topicCount: 6,
        replyCount: 6,
        avgTextLength: 120,
        activeDays: 5,
      },
      communityBreakdowns: [
        expect.objectContaining({
          community: 'v2ex',
          handle: 'alpha',
        }),
      ],
      warnings: [],
    });
  });

  test('keeps summary cautious and warnings visible for low-data degraded samples', () => {
    const report = new ReportBuilder().build(
      reportInput({
        archetype: 'INSUFFICIENT_DATA',
        confidenceProfile: makeConfidenceProfile({
          overall: 0.28,
        }),
        featureVector: makeFeatureVector({
          dataQuality: {
            degraded: true,
            sufficientData: false,
            qualityFlags: ['LOW_ACTIVITY_VOLUME', 'DEGRADED_SOURCE'],
            evidenceDensity: 0.2,
          },
        }),
        primaryArchetype: {
          code: 'INSUFFICIENT_DATA',
          score: 0.88,
          rationale: 'The sample does not support a stronger primary archetype yet.',
          supportingSignalCodes: ['LOW_DATA'],
        },
        tags: [
          {
            code: 'LOW_DATA',
            displayName: 'low-data',
            summaryHint: 'The current portrait is based on a limited sample.',
            supportingSignalCodes: ['LOW_DATA'],
          },
        ],
        warnings: [
          {
            code: 'PARTIAL_RESULT',
            message: 'Topics were partially available for this request.',
          },
        ],
      }),
    );

    expect(report.portrait.archetype).toBe('insufficient-data');
    expect(report.portrait.confidence).toBe(0.28);
    expect(report.portrait.summary).toContain('当前样本有限');
    expect(report.warnings).toEqual([
      {
        code: 'PARTIAL_RESULT',
        message: 'Topics were partially available for this request.',
      },
    ]);
  });

  test('maps metrics strictly from FeatureVector', () => {
    const report = new ReportBuilder().build(
      reportInput({
        featureVector: makeFeatureVector({
          activity: {
            totalActivities: 21,
            topicCount: 8,
            replyCount: 13,
            activeDays: 7,
          },
          content: {
            avgTextLength: 144,
          },
        }),
      }),
    );

    expect(report.metrics).toEqual({
      totalActivities: 21,
      topicCount: 8,
      replyCount: 13,
      avgTextLength: 144,
      activeDays: 7,
    });
  });

  test('maps evidence from selectedEvidence and dedupes repeated items', () => {
    const repeated = makeEvidenceCandidate({
      id: 'e-repeat',
      activityId: 'a-repeat',
      activityUrl: 'https://example.com/t/repeat',
      excerpt: 'Repeated evidence entry.',
      reasons: ['community-coverage'],
    });
    const report = new ReportBuilder().build(
      reportInput({
        selectedEvidence: [
          repeated,
          repeated,
          makeEvidenceCandidate({
            id: 'e-topic',
            activityId: 'a-topic',
            activityType: 'topic',
            activityUrl: 'https://example.com/t/topic',
            excerpt: 'Topic evidence entry.',
            reasons: ['node-context'],
          }),
        ],
      }),
    );

    expect(report.evidence).toHaveLength(2);
    expect(report.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Cross-community evidence',
          excerpt: 'Repeated evidence entry.',
        }),
        expect.objectContaining({
          label: 'Node-context evidence',
          activityUrl: 'https://example.com/t/topic',
        }),
      ]),
    );
  });

  test('builds distinguishable community breakdowns for multi-community input', () => {
    const report = new ReportBuilder().build(
      reportInput({
        featureVector: makeFeatureVector({
          activity: {
            activeCommunities: ['guozaoke', 'v2ex'],
            activeCommunityCount: 2,
          },
          community: {
            communityActivityShare: {
              v2ex: 0.6,
              guozaoke: 0.4,
            },
            crossCommunity: true,
            perCommunityMetrics: {
              'v2ex:alpha': {
                community: 'v2ex',
                handle: 'alpha',
                totalActivities: 7,
                topicCount: 2,
                replyCount: 5,
                activeDays: 4,
                avgTextLength: 120,
                longFormRatio: 0.2,
                questionRatio: 0.1,
                linkRatio: 0.05,
              },
              'guozaoke:beta': {
                community: 'guozaoke',
                handle: 'beta',
                totalActivities: 5,
                topicCount: 4,
                replyCount: 1,
                activeDays: 3,
                avgTextLength: 210,
                longFormRatio: 0.4,
                questionRatio: 0.08,
                linkRatio: 0.14,
              },
            },
          },
        }),
        synthesisResult: {
          stableTraits: ['CROSS_COMMUNITY', 'DISCUSSION_HEAVY'],
          communityInsights: [
            {
              community: 'v2ex',
              handle: 'alpha',
              dominantTraits: ['DISCUSSION_HEAVY'],
              summaryHint: 'Observed 7 activities on v2ex with a reply-led pattern.',
            },
            {
              community: 'guozaoke',
              handle: 'beta',
              dominantTraits: ['TOPIC_LED', 'LONG_FORM'],
              summaryHint: 'Observed 5 activities on guozaoke with a topic-led pattern.',
            },
          ],
        },
        tags: [
          {
            code: 'DISCUSSION_HEAVY',
            displayName: 'discussion-heavy',
            summaryHint: 'Reply activity is a primary participation pattern.',
            supportingSignalCodes: ['DISCUSSION_HEAVY'],
          },
          {
            code: 'TOPIC_LED',
            displayName: 'topic-led',
            summaryHint: 'Topic creation is a primary participation pattern.',
            supportingSignalCodes: ['TOPIC_LED'],
          },
          {
            code: 'LONG_FORM',
            displayName: 'long-form',
            summaryHint: 'Longer-form text is a recurring pattern in the current sample.',
            supportingSignalCodes: ['LONG_FORM'],
          },
        ],
      }),
    );

    expect(report.communityBreakdowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          community: 'v2ex',
          tags: ['discussion-heavy'],
          metrics: {
            totalActivities: 7,
            topicCount: 2,
            replyCount: 5,
          },
        }),
        expect.objectContaining({
          community: 'guozaoke',
          tags: ['topic-led', 'long-form'],
          metrics: {
            totalActivities: 5,
            topicCount: 4,
            replyCount: 1,
          },
        }),
      ]),
    );
  });
});
