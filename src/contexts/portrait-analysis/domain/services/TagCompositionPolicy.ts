import type { TagCode } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';

export const MIN_SIGNAL_SCORE_FOR_TAG = 0.55;
export const MAX_TAGS_HIGH_CONFIDENCE = 5;
export const MAX_TAGS_LOW_CONFIDENCE = 3;
export const LOW_CONFIDENCE_TAG_THRESHOLD = 0.55;
export const LOW_DATA_STRONG_SIGNAL_THRESHOLD = 0.75;

export const TAG_DEFINITIONS: Record<
  TagCode,
  { displayName: string; summaryHint: string }
> = {
  DISCUSSION_HEAVY: {
    displayName: 'discussion-heavy',
    summaryHint: 'Reply activity is a primary participation pattern.',
  },
  TOPIC_LED: {
    displayName: 'topic-led',
    summaryHint: 'Topic creation is a primary participation pattern.',
  },
  HIGH_OUTPUT: {
    displayName: 'high-output',
    summaryHint: 'The current sample shows comparatively high activity volume.',
  },
  LONG_FORM: {
    displayName: 'long-form',
    summaryHint: 'Longer-form text is a recurring pattern in the current sample.',
  },
  CROSS_COMMUNITY: {
    displayName: 'cross-community',
    summaryHint: 'The current sample spans more than one community.',
  },
  LOW_DATA: {
    displayName: 'low-data',
    summaryHint: 'The current portrait is based on a limited or degraded sample.',
  },
  QUESTION_ORIENTED: {
    displayName: 'question-oriented',
    summaryHint: 'Question-like phrasing appears frequently in the current sample.',
  },
  FOCUSED_TOPICS: {
    displayName: 'focused-topics',
    summaryHint: 'Activity appears concentrated around a smaller set of nodes.',
  },
  DIVERSE_TOPICS: {
    displayName: 'diverse-topics',
    summaryHint: 'Activity appears spread across a broader set of nodes.',
  },
};
