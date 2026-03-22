export const TAG_CODES = [
  'DISCUSSION_HEAVY',
  'TOPIC_LED',
  'HIGH_OUTPUT',
  'LONG_FORM',
  'CROSS_COMMUNITY',
  'LOW_DATA',
  'QUESTION_ORIENTED',
  'FOCUSED_TOPICS',
  'DIVERSE_TOPICS',
] as const;

export type TagCode = (typeof TAG_CODES)[number];
