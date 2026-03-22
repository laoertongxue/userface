import type { CommunitySynthesisResult } from '@/src/contexts/portrait-analysis/application/dto/CommunitySynthesisResult';
import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import {
  DISCUSSION_HEAVY_REPLY_RATIO,
  HIGH_OUTPUT_TOTAL_ACTIVITIES,
  LONG_FORM_RATIO_THRESHOLD,
  QUESTION_RATIO_THRESHOLD,
  TOPIC_LED_TOPIC_RATIO,
} from '@/src/contexts/portrait-analysis/domain/services/SignalDerivationPolicy';
import type { TagCode } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';

type CrossCommunitySynthesisInput = {
  featureVector: FeatureVector;
  signals: Signal[];
  tags: PortraitTag[];
  selectedEvidence: EvidenceCandidate[];
  confidenceProfile: ConfidenceProfile;
};

function clamp01(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

function signalScore(signals: Signal[], code: Signal['code']): number {
  return signals.find((signal) => signal.code === code)?.score ?? 0;
}

function parseCommunityMetricKey(key: string): { community: string; handle: string } {
  const separatorIndex = key.indexOf(':');

  if (separatorIndex === -1) {
    return {
      community: key,
      handle: key,
    };
  }

  return {
    community: key.slice(0, separatorIndex),
    handle: key.slice(separatorIndex + 1),
  };
}

function dominantTraitsForCommunity(
  metrics: FeatureVector['community']['perCommunityMetrics'][string],
): TagCode[] {
  const traits: TagCode[] = [];
  const totalActivities = metrics.totalActivities;

  if (totalActivities === 0) {
    return ['LOW_DATA'];
  }

  const replyRatio = totalActivities === 0 ? 0 : metrics.replyCount / totalActivities;
  const topicRatio = totalActivities === 0 ? 0 : metrics.topicCount / totalActivities;

  if (replyRatio >= DISCUSSION_HEAVY_REPLY_RATIO) {
    traits.push('DISCUSSION_HEAVY');
  }

  if (topicRatio >= TOPIC_LED_TOPIC_RATIO) {
    traits.push('TOPIC_LED');
  }

  if (
    metrics.longFormRatio >= LONG_FORM_RATIO_THRESHOLD ||
    metrics.avgTextLength >= 200
  ) {
    traits.push('LONG_FORM');
  }

  if (metrics.questionRatio >= QUESTION_RATIO_THRESHOLD) {
    traits.push('QUESTION_ORIENTED');
  }

  if (metrics.totalActivities >= Math.max(10, HIGH_OUTPUT_TOTAL_ACTIVITIES / 2)) {
    traits.push('HIGH_OUTPUT');
  }

  return traits.slice(0, 3);
}

export class CrossCommunitySynthesisService {
  synthesize(input: CrossCommunitySynthesisInput): CommunitySynthesisResult {
    const { featureVector, signals, tags } = input;
    const tagSignalScore = new Map<TagCode, number>(
      tags.map((tag) => [tag.code, Math.max(...tag.supportingSignalCodes.map((code) => signalScore(signals, code)), 0)]),
    );

    const stableTraits =
      featureVector.community.crossCommunity
        ? tags
            .filter((tag) => (tagSignalScore.get(tag.code) ?? 0) >= 0.62)
            .map((tag) => tag.code)
            .slice(0, 4)
        : tags.map((tag) => tag.code).slice(0, 4);

    const communityInsights = Object.entries(featureVector.community.perCommunityMetrics).map(
      ([key, metrics]) => {
        const parsed = parseCommunityMetricKey(key);
        const dominantTraits = dominantTraitsForCommunity(metrics);
        const share = featureVector.community.communityActivityShare[metrics.community] ?? 0;
        const confidenceModifier = clamp01(
          share * 0.55 + Math.min(metrics.totalActivities / 10, 1) * 0.45,
        );
        const summaryParts: string[] = [`Observed ${metrics.totalActivities} activities on ${metrics.community}`];

        if (dominantTraits.includes('DISCUSSION_HEAVY')) {
          summaryParts.push('with a reply-led pattern');
        } else if (dominantTraits.includes('TOPIC_LED')) {
          summaryParts.push('with a topic-led pattern');
        } else if (dominantTraits.includes('LOW_DATA')) {
          summaryParts.push('with limited analyzable activity');
        } else {
          summaryParts.push('with a mixed participation pattern');
        }

        return {
          community: metrics.community,
          handle: parsed.handle,
          dominantTraits:
            dominantTraits.length > 0
              ? dominantTraits
              : stableTraits.slice(0, 2),
          summaryHint: `${summaryParts.join(' ')}.`,
          confidenceModifier:
            featureVector.community.crossCommunity || input.confidenceProfile.overall >= 0.45
              ? confidenceModifier
              : undefined,
        };
      },
    );

    return {
      stableTraits:
        stableTraits.length > 0
          ? stableTraits
          : featureVector.dataQuality.sufficientData
            ? tags.slice(0, 2).map((tag) => tag.code)
            : ['LOW_DATA'],
      communityInsights,
    };
  }
}
