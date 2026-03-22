export const clusterAnalysisModeValues = ['SINGLE_ACCOUNT', 'MANUAL_CLUSTER'] as const;

export type ClusterAnalysisMode = (typeof clusterAnalysisModeValues)[number];
