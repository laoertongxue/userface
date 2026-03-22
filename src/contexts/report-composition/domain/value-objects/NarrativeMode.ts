export const narrativeModeValues = ['OFF', 'RULE_ONLY', 'LLM_ASSISTED'] as const;

export type NarrativeMode = (typeof narrativeModeValues)[number];

