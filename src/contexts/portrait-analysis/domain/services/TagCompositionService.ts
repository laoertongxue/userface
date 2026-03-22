import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import {
  LOW_CONFIDENCE_TAG_THRESHOLD,
  LOW_DATA_STRONG_SIGNAL_THRESHOLD,
  MAX_TAGS_HIGH_CONFIDENCE,
  MAX_TAGS_LOW_CONFIDENCE,
  MIN_SIGNAL_SCORE_FOR_TAG,
  TAG_DEFINITIONS,
} from '@/src/contexts/portrait-analysis/domain/services/TagCompositionPolicy';
import type { TagCode } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';

type TagCompositionInput = {
  signals: Signal[];
  confidenceProfile: ConfidenceProfile;
};

const SIGNAL_TO_TAG: Partial<Record<Signal['code'], TagCode>> = {
  DISCUSSION_HEAVY: 'DISCUSSION_HEAVY',
  TOPIC_LED: 'TOPIC_LED',
  HIGH_OUTPUT: 'HIGH_OUTPUT',
  LONG_FORM: 'LONG_FORM',
  CROSS_COMMUNITY: 'CROSS_COMMUNITY',
  LOW_DATA: 'LOW_DATA',
  QUESTION_ORIENTED: 'QUESTION_ORIENTED',
  FOCUSED_TOPICS: 'FOCUSED_TOPICS',
  DIVERSE_TOPICS: 'DIVERSE_TOPICS',
};

export class TagCompositionService {
  compose(input: TagCompositionInput): PortraitTag[] {
    const signalMap = new Map(input.signals.map((signal) => [signal.code, signal]));
    const lowDataSignal = signalMap.get('LOW_DATA');
    const lowDataStrong = (lowDataSignal?.score ?? 0) >= LOW_DATA_STRONG_SIGNAL_THRESHOLD;
    const maxTags =
      input.confidenceProfile.overall < LOW_CONFIDENCE_TAG_THRESHOLD || lowDataStrong
        ? MAX_TAGS_LOW_CONFIDENCE
        : MAX_TAGS_HIGH_CONFIDENCE;

    const eligible = input.signals
      .filter((signal) => signal.score >= MIN_SIGNAL_SCORE_FOR_TAG)
      .filter((signal) => SIGNAL_TO_TAG[signal.code])
      .sort((left, right) => right.score - left.score);

    const selectedCodes = new Set<TagCode>();

    if (lowDataSignal) {
      selectedCodes.add('LOW_DATA');
    }

    for (const signal of eligible) {
      const tagCode = SIGNAL_TO_TAG[signal.code];

      if (!tagCode || selectedCodes.has(tagCode)) {
        continue;
      }

      if (tagCode === 'FOCUSED_TOPICS' && selectedCodes.has('DIVERSE_TOPICS')) {
        continue;
      }

      if (tagCode === 'DIVERSE_TOPICS' && selectedCodes.has('FOCUSED_TOPICS')) {
        const focusedSignal = signalMap.get('FOCUSED_TOPICS');

        if ((focusedSignal?.score ?? 0) >= signal.score) {
          continue;
        }

        selectedCodes.delete('FOCUSED_TOPICS');
      }

      if (selectedCodes.size >= maxTags) {
        break;
      }

      selectedCodes.add(tagCode);
    }

    return [...selectedCodes]
      .map((code) => {
        const supportingSignals = input.signals
          .filter((signal) => SIGNAL_TO_TAG[signal.code] === code)
          .sort((left, right) => right.score - left.score);
        const definition = TAG_DEFINITIONS[code];

        return {
          code,
          displayName: definition.displayName,
          summaryHint: definition.summaryHint,
          supportingSignalCodes: supportingSignals.map((signal) => signal.code),
        };
      })
      .sort((left, right) => {
        const leftScore = signalMap.get(left.supportingSignalCodes[0])?.score ?? 0;
        const rightScore = signalMap.get(right.supportingSignalCodes[0])?.score ?? 0;

        return rightScore - leftScore;
      })
      .slice(0, maxTags);
  }
}
