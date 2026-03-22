export const MIN_ACTIVITY_FOR_STRONG_SIGNAL = 8;
export const DISCUSSION_HEAVY_REPLY_RATIO = 0.65;
export const TOPIC_LED_TOPIC_RATIO = 0.55;
export const HIGH_OUTPUT_TOTAL_ACTIVITIES = 20;
export const LONG_FORM_RATIO_THRESHOLD = 0.35;
export const QUESTION_RATIO_THRESHOLD = 0.25;
export const FOCUSED_TOPIC_CONCENTRATION = 0.55;
export const DIVERSE_TOPIC_SCORE = 0.3;
export const CROSS_COMMUNITY_MIN_COUNT = 2;
export const MIN_UNIQUE_NODES_FOR_DIVERSE_TOPICS = 3;

export const SIGNAL_DERIVATION_POLICY = {
  minActivityForStrongSignal: MIN_ACTIVITY_FOR_STRONG_SIGNAL,
  discussionHeavyReplyRatio: DISCUSSION_HEAVY_REPLY_RATIO,
  topicLedTopicRatio: TOPIC_LED_TOPIC_RATIO,
  highOutputTotalActivities: HIGH_OUTPUT_TOTAL_ACTIVITIES,
  longFormRatioThreshold: LONG_FORM_RATIO_THRESHOLD,
  questionRatioThreshold: QUESTION_RATIO_THRESHOLD,
  focusedTopicConcentration: FOCUSED_TOPIC_CONCENTRATION,
  diverseTopicScore: DIVERSE_TOPIC_SCORE,
  crossCommunityMinCount: CROSS_COMMUNITY_MIN_COUNT,
  minUniqueNodesForDiverseTopics: MIN_UNIQUE_NODES_FOR_DIVERSE_TOPICS,
} as const;
