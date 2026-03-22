import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import {
  CROSS_COMMUNITY_MIN_COUNT,
  DISCUSSION_HEAVY_REPLY_RATIO,
  DIVERSE_TOPIC_SCORE,
  FOCUSED_TOPIC_CONCENTRATION,
  HIGH_OUTPUT_TOTAL_ACTIVITIES,
  LONG_FORM_RATIO_THRESHOLD,
  MIN_ACTIVITY_FOR_STRONG_SIGNAL,
  MIN_UNIQUE_NODES_FOR_DIVERSE_TOPICS,
  QUESTION_RATIO_THRESHOLD,
  TOPIC_LED_TOPIC_RATIO,
} from '@/src/contexts/portrait-analysis/domain/services/SignalDerivationPolicy';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';

type SignalDerivationInput = {
  featureVector: FeatureVector;
  confidenceProfile: ConfidenceProfile;
  selectedEvidence: EvidenceCandidate[];
};

function clamp01(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

function pushSignal(
  target: Signal[],
  input: Omit<Signal, 'score'> & { score: number },
): void {
  target.push({
    ...input,
    score: clamp01(input.score),
  });
}

function evidenceIdsFor(
  selectedEvidence: EvidenceCandidate[],
  code: SignalCode,
): string[] {
  switch (code) {
    case 'DISCUSSION_HEAVY':
      return selectedEvidence
        .filter((item) => item.activityType === 'reply')
        .slice(0, 3)
        .map((item) => item.id);
    case 'TOPIC_LED':
      return selectedEvidence
        .filter((item) => item.activityType === 'topic')
        .slice(0, 3)
        .map((item) => item.id);
    case 'QUESTION_ORIENTED':
      return selectedEvidence
        .filter((item) => item.excerpt.includes('?') || item.excerpt.includes('？'))
        .slice(0, 3)
        .map((item) => item.id);
    case 'LONG_FORM':
      return selectedEvidence
        .filter((item) => (item.textLength ?? item.excerpt.length) >= 80)
        .slice(0, 3)
        .map((item) => item.id);
    case 'FOCUSED_TOPICS':
    case 'DIVERSE_TOPICS':
      return selectedEvidence
        .filter((item) => Boolean(item.nodeName) || item.activityType === 'topic')
        .slice(0, 3)
        .map((item) => item.id);
    case 'CROSS_COMMUNITY': {
      const picked = new Set<string>();

      return selectedEvidence
        .filter((item) => {
          if (picked.has(item.community)) {
            return false;
          }

          picked.add(item.community);
          return true;
        })
        .slice(0, 3)
        .map((item) => item.id);
    }
    case 'HIGH_OUTPUT':
    case 'LOW_DATA':
      return selectedEvidence.slice(0, 3).map((item) => item.id);
  }
}

export class SignalDerivationService {
  derive(input: SignalDerivationInput): Signal[] {
    const { featureVector, confidenceProfile, selectedEvidence } = input;
    const signals: Signal[] = [];
    const volumeFactor = clamp01(
      featureVector.activity.totalActivities / (MIN_ACTIVITY_FOR_STRONG_SIGNAL * 2),
    );

    if (
      featureVector.activity.totalActivities >= MIN_ACTIVITY_FOR_STRONG_SIGNAL &&
      featureVector.activity.replyRatio >= DISCUSSION_HEAVY_REPLY_RATIO
    ) {
      pushSignal(signals, {
        code: 'DISCUSSION_HEAVY',
        score:
          featureVector.activity.replyRatio * 0.75 +
          featureVector.activity.avgActivitiesPerActiveDay * 0.05 +
          volumeFactor * 0.2,
        rationale: 'Replies dominate the current activity sample.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'DISCUSSION_HEAVY'),
        communityScope: 'global',
      });
    }

    if (
      featureVector.activity.totalActivities >= MIN_ACTIVITY_FOR_STRONG_SIGNAL &&
      featureVector.activity.topicRatio >= TOPIC_LED_TOPIC_RATIO
    ) {
      pushSignal(signals, {
        code: 'TOPIC_LED',
        score:
          featureVector.activity.topicRatio * 0.75 +
          featureVector.content.linkRatio * 0.1 +
          volumeFactor * 0.15,
        rationale: 'Topic creation is a strong share of the current sample.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'TOPIC_LED'),
        communityScope: 'global',
      });
    }

    if (
      featureVector.activity.totalActivities >= HIGH_OUTPUT_TOTAL_ACTIVITIES ||
      featureVector.activity.avgActivitiesPerActiveDay >= 4
    ) {
      pushSignal(signals, {
        code: 'HIGH_OUTPUT',
        score:
          Math.min(
            featureVector.activity.totalActivities / (HIGH_OUTPUT_TOTAL_ACTIVITIES * 1.5),
            1,
          ) *
            0.7 +
          Math.min(featureVector.activity.avgActivitiesPerActiveDay / 6, 1) * 0.3,
        rationale: 'Activity volume is strong relative to the baseline thresholds.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'HIGH_OUTPUT'),
        communityScope: 'global',
      });
    }

    if (
      featureVector.content.longFormRatio >= LONG_FORM_RATIO_THRESHOLD ||
      featureVector.content.avgTextLength >= 200
    ) {
      pushSignal(signals, {
        code: 'LONG_FORM',
        score:
          Math.min(featureVector.content.longFormRatio / 0.6, 1) * 0.55 +
          Math.min(featureVector.content.avgTextLength / 320, 1) * 0.45,
        rationale: 'Longer-form writing appears repeatedly in the current sample.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'LONG_FORM'),
        communityScope: 'global',
      });
    }

    if (
      featureVector.community.crossCommunity &&
      featureVector.activity.activeCommunityCount >= CROSS_COMMUNITY_MIN_COUNT
    ) {
      const communityShares = Object.values(featureVector.community.communityActivityShare);
      const maxShare = communityShares.length === 0 ? 1 : Math.max(...communityShares);
      const balanceScore = clamp01(1 - Math.max(maxShare - 0.5, 0) * 2);

      pushSignal(signals, {
        code: 'CROSS_COMMUNITY',
        score:
          clamp01(featureVector.activity.activeCommunityCount / 3) * 0.55 +
          balanceScore * 0.45,
        rationale: 'Meaningful activity appears in more than one community.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'CROSS_COMMUNITY'),
        communityScope: 'global',
      });
    }

    if (
      !featureVector.dataQuality.sufficientData ||
      featureVector.dataQuality.qualityFlags.length > 0
    ) {
      pushSignal(signals, {
        code: 'LOW_DATA',
        score:
          0.65 +
          featureVector.dataQuality.qualityFlags.length * 0.06 +
          (featureVector.dataQuality.degraded ? 0.08 : 0) +
          (confidenceProfile.overall < 0.45 ? 0.08 : 0),
        rationale: 'The current sample has limited or degraded analytical support.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'LOW_DATA'),
        communityScope: 'global',
      });
    }

    if (featureVector.content.questionRatio >= QUESTION_RATIO_THRESHOLD) {
      pushSignal(signals, {
        code: 'QUESTION_ORIENTED',
        score:
          Math.min(featureVector.content.questionRatio / 0.5, 1) * 0.8 +
          volumeFactor * 0.2,
        rationale: 'Question-like phrasing appears frequently in the sample.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'QUESTION_ORIENTED'),
        communityScope: 'global',
      });
    }

    if (
      featureVector.topic.uniqueNodeCount > 0 &&
      featureVector.topic.topicConcentration >= FOCUSED_TOPIC_CONCENTRATION &&
      featureVector.topic.diversityScore < DIVERSE_TOPIC_SCORE
    ) {
      pushSignal(signals, {
        code: 'FOCUSED_TOPICS',
        score:
          featureVector.topic.topicConcentration * 0.75 +
          (1 - featureVector.topic.diversityScore) * 0.25,
        rationale: 'Activity is concentrated around a narrower set of nodes.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'FOCUSED_TOPICS'),
        communityScope: 'global',
      });
    }

    if (
      featureVector.topic.diversityScore >= DIVERSE_TOPIC_SCORE &&
      featureVector.topic.uniqueNodeCount >= MIN_UNIQUE_NODES_FOR_DIVERSE_TOPICS
    ) {
      pushSignal(signals, {
        code: 'DIVERSE_TOPICS',
        score:
          featureVector.topic.diversityScore * 0.7 +
          Math.min(featureVector.topic.uniqueNodeCount / 6, 1) * 0.3,
        rationale: 'Activity spans a relatively diverse set of nodes.',
        supportingEvidenceIds: evidenceIdsFor(selectedEvidence, 'DIVERSE_TOPICS'),
        communityScope: 'global',
      });
    }

    return signals.sort((left, right) => right.score - left.score);
  }
}
