export const clusterAnalysisScopeValues = [
  'PER_ACCOUNT_ONLY',
  'AGGREGATED_ONLY',
  'AGGREGATED_WITH_BREAKDOWN',
] as const;

export type ClusterAnalysisScope = (typeof clusterAnalysisScopeValues)[number];
