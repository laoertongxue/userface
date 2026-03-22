export const narrativeFallbackModeValues = ['USE_RULE_SUMMARY', 'SKIP_NARRATIVE'] as const;

export type NarrativeFallbackMode = (typeof narrativeFallbackModeValues)[number];

