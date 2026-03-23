export const featureSwitchKeyValues = [
  'ANALYZE_ENABLED',
  'CLUSTER_ANALYSIS_ENABLED',
  'SUGGEST_ENABLED',
  'NARRATIVE_ENABLED',
  'MINIMAX_ENABLED',
  'HEALTH_PROBES_ENABLED',
  'STRICT_GOVERNANCE_ENABLED',
] as const;

export type FeatureSwitchKey = (typeof featureSwitchKeyValues)[number];
