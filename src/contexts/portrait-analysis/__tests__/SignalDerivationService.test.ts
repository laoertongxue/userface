import { describe, expect, test } from 'vitest';
import { SignalDerivationService } from '@/src/contexts/portrait-analysis/domain/services/SignalDerivationService';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';

describe('SignalDerivationService', () => {
  test('derives DISCUSSION_HEAVY from reply-dominant activity', () => {
    const signals = new SignalDerivationService().derive({
      featureVector: makeFeatureVector({
        activity: {
          totalActivities: 12,
          topicCount: 3,
          replyCount: 9,
          topicRatio: 0.25,
          replyRatio: 0.75,
        },
      }),
      confidenceProfile: makeConfidenceProfile(),
      selectedEvidence: [
        makeEvidenceCandidate({ id: 'e1', activityType: 'reply' }),
        makeEvidenceCandidate({ id: 'e2', activityId: 'a2', activityType: 'reply' }),
      ],
    });

    expect(signals.map((signal) => signal.code)).toContain('DISCUSSION_HEAVY');
  });

  test('derives TOPIC_LED from topic-dominant activity', () => {
    const signals = new SignalDerivationService().derive({
      featureVector: makeFeatureVector({
        activity: {
          totalActivities: 12,
          topicCount: 8,
          replyCount: 4,
          topicRatio: 0.6667,
          replyRatio: 0.3333,
        },
      }),
      confidenceProfile: makeConfidenceProfile(),
      selectedEvidence: [
        makeEvidenceCandidate({ id: 'e1', activityType: 'topic' }),
        makeEvidenceCandidate({ id: 'e2', activityId: 'a2', activityType: 'topic' }),
      ],
    });

    expect(signals.map((signal) => signal.code)).toContain('TOPIC_LED');
  });

  test('derives LOW_DATA when sufficient data is not met', () => {
    const signals = new SignalDerivationService().derive({
      featureVector: makeFeatureVector({
        activity: {
          totalActivities: 2,
          activeDays: 1,
        },
        dataQuality: {
          sufficientData: false,
          evidenceDensity: 0.2,
          qualityFlags: ['LOW_ACTIVITY_VOLUME', 'LOW_ACTIVE_DAYS', 'LOW_TEXT_DENSITY'],
        },
      }),
      confidenceProfile: makeConfidenceProfile({
        overall: 0.28,
        flags: ['LOW_ACTIVITY_VOLUME', 'LOW_ACTIVE_DAYS', 'LOW_TEXT_DENSITY'],
      }),
      selectedEvidence: [makeEvidenceCandidate()],
    });

    expect(signals.map((signal) => signal.code)).toContain('LOW_DATA');
  });

  test('derives CROSS_COMMUNITY when activity spans multiple communities', () => {
    const signals = new SignalDerivationService().derive({
      featureVector: makeFeatureVector({
        activity: {
          activeCommunities: ['guozaoke', 'v2ex'],
          activeCommunityCount: 2,
        },
        community: {
          communityActivityShare: {
            v2ex: 0.55,
            guozaoke: 0.45,
          },
          crossCommunity: true,
          perCommunityMetrics: {
            'v2ex:alpha': {
              community: 'v2ex',
              handle: 'alpha',
              totalActivities: 7,
              topicCount: 3,
              replyCount: 4,
              activeDays: 4,
              avgTextLength: 120,
              longFormRatio: 0.2,
              questionRatio: 0.15,
              linkRatio: 0.05,
            },
            'guozaoke:beta': {
              community: 'guozaoke',
              handle: 'beta',
              totalActivities: 5,
              topicCount: 2,
              replyCount: 3,
              activeDays: 3,
              avgTextLength: 110,
              longFormRatio: 0.15,
              questionRatio: 0.1,
              linkRatio: 0.04,
            },
          },
        },
      }),
      confidenceProfile: makeConfidenceProfile(),
      selectedEvidence: [
        makeEvidenceCandidate({ id: 'e1', community: 'v2ex' }),
        makeEvidenceCandidate({
          id: 'e2',
          activityId: 'a2',
          community: 'guozaoke',
          activityUrl: 'https://example.com/t/2',
        }),
      ],
    });

    expect(signals.map((signal) => signal.code)).toContain('CROSS_COMMUNITY');
  });
});
