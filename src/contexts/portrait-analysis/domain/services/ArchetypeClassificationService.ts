import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type { PrimaryArchetype } from '@/src/contexts/portrait-analysis/application/dto/RuleEvaluationResult';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import {
  ARCHETYPE_PRECEDENCE,
  COMMUNITY_PARTICIPANT_MAX_RATIO_GAP,
  COMMUNITY_PARTICIPANT_MIN_ACTIVE_DAYS,
  COMMUNITY_PARTICIPANT_MIN_ACTIVITIES,
  DISCUSSION_ORIENTED_MIN_SCORE,
  INFORMATION_CURATOR_MIN_LINK_RATIO,
  INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD,
  LOW_DATA_STRONG_SIGNAL_THRESHOLD,
  OBSERVER_MAX_AVG_ACTIVITIES_PER_DAY,
  PROBLEM_SOLVER_MAX_QUESTION_RATIO,
  TOPIC_ORIENTED_MIN_SCORE,
} from '@/src/contexts/portrait-analysis/domain/services/ArchetypeClassificationPolicy';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';

type ArchetypeClassificationInput = {
  featureVector: FeatureVector;
  signals: Signal[];
  tags: PortraitTag[];
  confidenceProfile: ConfidenceProfile;
};

type Candidate = PrimaryArchetype;

function clamp01(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

function scoreOf(signals: Signal[], code: SignalCode): number {
  return signals.find((signal) => signal.code === code)?.score ?? 0;
}

function hasTag(tags: PortraitTag[], code: PortraitTag['code']): boolean {
  return tags.some((tag) => tag.code === code);
}

export class ArchetypeClassificationService {
  classify(input: ArchetypeClassificationInput): PrimaryArchetype {
    const lowDataScore = scoreOf(input.signals, 'LOW_DATA');

    if (
      !input.featureVector.dataQuality.sufficientData ||
      lowDataScore >= LOW_DATA_STRONG_SIGNAL_THRESHOLD ||
      input.confidenceProfile.overall <= INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD
    ) {
      return {
        code: 'INSUFFICIENT_DATA',
        score: clamp01(Math.max(lowDataScore, 1 - input.confidenceProfile.overall)),
        rationale: 'The current sample does not support a stronger primary archetype yet.',
        supportingSignalCodes: lowDataScore > 0 ? ['LOW_DATA'] : [],
      };
    }

    const discussionScore = scoreOf(input.signals, 'DISCUSSION_HEAVY');
    const topicLedScore = scoreOf(input.signals, 'TOPIC_LED');
    const highOutputScore = scoreOf(input.signals, 'HIGH_OUTPUT');
    const longFormScore = scoreOf(input.signals, 'LONG_FORM');
    const crossCommunityScore = scoreOf(input.signals, 'CROSS_COMMUNITY');
    const ratioGap = Math.abs(
      input.featureVector.activity.replyRatio - input.featureVector.activity.topicRatio,
    );

    const candidates: Candidate[] = [];

    if (
      discussionScore >= 0.6 &&
      input.featureVector.content.substantiveTextRatio >= 0.55 &&
      input.featureVector.content.questionRatio <= PROBLEM_SOLVER_MAX_QUESTION_RATIO
    ) {
      candidates.push({
        code: 'PROBLEM_SOLVER',
        score: clamp01(
          discussionScore * 0.55 +
            input.featureVector.content.substantiveTextRatio * 0.25 +
            input.confidenceProfile.textQuality * 0.2,
        ),
        rationale: 'Reply-heavy and substantive activity suggests a problem-solving posture.',
        supportingSignalCodes: ['DISCUSSION_HEAVY'],
      });
    }

    if (
      (topicLedScore >= 0.6 || hasTag(input.tags, 'TOPIC_LED') || highOutputScore >= 0.65) &&
      (longFormScore >= 0.55 ||
        input.featureVector.content.linkRatio >= INFORMATION_CURATOR_MIN_LINK_RATIO)
    ) {
      const curatorSynergy =
        topicLedScore >= 0.6 &&
        (longFormScore >= 0.55 ||
          input.featureVector.content.linkRatio >= INFORMATION_CURATOR_MIN_LINK_RATIO)
          ? 0.12
          : 0;

      candidates.push({
        code: 'INFORMATION_CURATOR',
        score: clamp01(
          Math.max(topicLedScore, 0.5) * 0.45 +
            Math.max(longFormScore, input.featureVector.content.linkRatio) * 0.3 +
            Math.max(highOutputScore, 0.3) * 0.1 +
            input.confidenceProfile.textQuality * 0.15 +
            curatorSynergy,
        ),
        rationale: 'Topic-led output with richer text or links suggests information curation.',
        supportingSignalCodes: [
          ...(topicLedScore > 0 ? ['TOPIC_LED' as const] : []),
          ...(longFormScore > 0 ? ['LONG_FORM' as const] : []),
        ],
      });
    }

    if (
      discussionScore >= DISCUSSION_ORIENTED_MIN_SCORE &&
      input.featureVector.activity.replyRatio >= 0.6 &&
      input.featureVector.activity.activeDays >= 3
    ) {
      candidates.push({
        code: 'DISCUSSION_ORIENTED',
        score: clamp01(
          discussionScore * 0.65 +
            input.featureVector.activity.replyRatio * 0.2 +
            input.confidenceProfile.dataVolume * 0.15,
        ),
        rationale: 'Replies are a strong and sustained pattern in the current sample.',
        supportingSignalCodes: ['DISCUSSION_HEAVY'],
      });
    }

    if (
      topicLedScore >= TOPIC_ORIENTED_MIN_SCORE &&
      input.featureVector.activity.topicRatio >= 0.55 &&
      input.featureVector.activity.totalActivities >= 8
    ) {
      candidates.push({
        code: 'TOPIC_ORIENTED',
        score: clamp01(
          topicLedScore * 0.65 +
            input.featureVector.activity.topicRatio * 0.2 +
            input.confidenceProfile.dataVolume * 0.15,
        ),
        rationale: 'Topic creation is the dominant contribution pattern in the sample.',
        supportingSignalCodes: ['TOPIC_LED'],
      });
    }

    if (
      input.featureVector.activity.totalActivities >= COMMUNITY_PARTICIPANT_MIN_ACTIVITIES &&
      input.featureVector.activity.activeDays >= COMMUNITY_PARTICIPANT_MIN_ACTIVE_DAYS &&
      ratioGap <= COMMUNITY_PARTICIPANT_MAX_RATIO_GAP
    ) {
      candidates.push({
        code: 'COMMUNITY_PARTICIPANT',
        score: clamp01(
          input.confidenceProfile.activitySpan * 0.35 +
            (1 - ratioGap) * 0.25 +
            input.confidenceProfile.dataVolume * 0.25 +
            Math.max(crossCommunityScore, 0.3) * 0.15,
        ),
        rationale: 'The sample shows steady participation without a sharply single-sided pattern.',
        supportingSignalCodes: [
          ...(discussionScore > 0 ? ['DISCUSSION_HEAVY' as const] : []),
          ...(topicLedScore > 0 ? ['TOPIC_LED' as const] : []),
          ...(crossCommunityScore > 0 ? ['CROSS_COMMUNITY' as const] : []),
        ],
      });
    }

    if (
      input.featureVector.activity.avgActivitiesPerActiveDay <= OBSERVER_MAX_AVG_ACTIVITIES_PER_DAY &&
      input.featureVector.activity.activeSpanDays >= 7 &&
      !candidates.some((candidate) => candidate.code === 'COMMUNITY_PARTICIPANT')
    ) {
      candidates.push({
        code: 'OBSERVER',
        score: clamp01(
          0.45 +
            input.confidenceProfile.activitySpan * 0.25 +
            (1 - input.featureVector.activity.avgActivitiesPerActiveDay / 2) * 0.3,
        ),
        rationale: 'The sample shows a lighter but still sustained participation footprint.',
        supportingSignalCodes: [],
      });
    }

    if (candidates.length === 0) {
      return {
        code: 'COMMUNITY_PARTICIPANT',
        score: clamp01(
          input.confidenceProfile.dataVolume * 0.35 +
            input.confidenceProfile.activitySpan * 0.35 +
            input.confidenceProfile.coverage * 0.3,
        ),
        rationale: 'The sample supports a general community participation pattern.',
        supportingSignalCodes: [],
      };
    }

    const precedence = new Map<ArchetypeCode, number>(
      ARCHETYPE_PRECEDENCE.map((code, index) => [code, index]),
    );

    candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (precedence.get(left.code) ?? 99) - (precedence.get(right.code) ?? 99);
    });

    return candidates[0];
  }
}
