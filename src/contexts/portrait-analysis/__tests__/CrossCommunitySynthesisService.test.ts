import { describe, expect, test } from 'vitest';
import { CrossCommunitySynthesisService } from '@/src/contexts/portrait-analysis/domain/services/CrossCommunitySynthesisService';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';

function tags(codes: PortraitTag['code'][]): PortraitTag[] {
  return codes.map((code) => ({
    code,
    displayName: code.toLowerCase(),
    summaryHint: 'hint',
    supportingSignalCodes: [code as SignalCode],
  }));
}

describe('CrossCommunitySynthesisService', () => {
  test('returns minimal stable traits and community insight for single-community input', () => {
    const result = new CrossCommunitySynthesisService().synthesize({
      featureVector: makeFeatureVector(),
      signals: [makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.72 })],
      tags: tags(['DISCUSSION_HEAVY']),
      selectedEvidence: [makeEvidenceCandidate()],
      confidenceProfile: makeConfidenceProfile(),
    });

    expect(result.stableTraits).toEqual(['DISCUSSION_HEAVY']);
    expect(result.communityInsights).toHaveLength(1);
    expect(result.communityInsights[0]).toMatchObject({
      community: 'v2ex',
      handle: 'alpha',
    });
  });

  test('separates stable traits and community-specific traits for dual-community input', () => {
    const result = new CrossCommunitySynthesisService().synthesize({
      featureVector: makeFeatureVector({
        activity: {
          activeCommunities: ['guozaoke', 'v2ex'],
          activeCommunityCount: 2,
        },
        community: {
          communityActivityShare: {
            v2ex: 0.58,
            guozaoke: 0.42,
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
              avgTextLength: 220,
              longFormRatio: 0.45,
              questionRatio: 0.12,
              linkRatio: 0.16,
            },
          },
        },
      }),
      signals: [
        makeSignal({ code: 'CROSS_COMMUNITY', score: 0.72 }),
        makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.68 }),
        makeSignal({ code: 'TOPIC_LED', score: 0.66 }),
      ],
      tags: tags(['CROSS_COMMUNITY', 'DISCUSSION_HEAVY', 'TOPIC_LED', 'LONG_FORM']),
      selectedEvidence: [
        makeEvidenceCandidate({ community: 'v2ex' }),
        makeEvidenceCandidate({
          id: 'e2',
          activityId: 'a2',
          community: 'guozaoke',
          activityUrl: 'https://example.com/t/2',
        }),
      ],
      confidenceProfile: makeConfidenceProfile({ overall: 0.77 }),
    });

    expect(result.stableTraits).toEqual(
      expect.arrayContaining(['CROSS_COMMUNITY', 'DISCUSSION_HEAVY', 'TOPIC_LED']),
    );
    expect(result.communityInsights).toHaveLength(2);
    expect(result.communityInsights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          community: 'v2ex',
          dominantTraits: expect.arrayContaining(['DISCUSSION_HEAVY']),
        }),
        expect.objectContaining({
          community: 'guozaoke',
          dominantTraits: expect.arrayContaining(['TOPIC_LED', 'LONG_FORM']),
        }),
      ]),
    );
  });
});
