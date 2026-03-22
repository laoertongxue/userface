export const MAX_SELECTED_EVIDENCE = 5;
export const MIN_SUBSTANTIVE_CHARS = 20;
export const MAX_TEXT_LENGTH_BONUS_THRESHOLD = 500;
export const COMMUNITY_DIVERSITY_BONUS = 0.12;
export const TYPE_DIVERSITY_BONUS = 0.1;
export const RECENCY_SOFT_BONUS = 0.08;
export const NODE_CONTEXT_BONUS = 0.05;
export const TOPIC_CONTEXT_BONUS = 0.05;
export const URL_PRESENT_BONUS = 0.05;
export const PUBLISHED_AT_PRESENT_BONUS = 0.03;

export const EVIDENCE_SELECTION_POLICY = {
  maxSelectedEvidence: MAX_SELECTED_EVIDENCE,
  minSubstantiveChars: MIN_SUBSTANTIVE_CHARS,
  maxTextLengthBonusThreshold: MAX_TEXT_LENGTH_BONUS_THRESHOLD,
  communityDiversityBonus: COMMUNITY_DIVERSITY_BONUS,
  typeDiversityBonus: TYPE_DIVERSITY_BONUS,
  recencySoftBonus: RECENCY_SOFT_BONUS,
  nodeContextBonus: NODE_CONTEXT_BONUS,
  topicContextBonus: TOPIC_CONTEXT_BONUS,
  urlPresentBonus: URL_PRESENT_BONUS,
  publishedAtPresentBonus: PUBLISHED_AT_PRESENT_BONUS,
} as const;
