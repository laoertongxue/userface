export const MIN_ACTIVITIES_FOR_MEDIUM_CONFIDENCE = 8;
export const MIN_ACTIVE_DAYS_FOR_MEDIUM_CONFIDENCE = 3;
export const MIN_EVIDENCE_FOR_STRONG_BASIS = 3;
export const DEGRADED_PENALTY = 0.18;
export const LOW_TEXT_DENSITY_PENALTY = 0.12;
export const LOW_EVIDENCE_COVERAGE_PENALTY = 0.1;
export const CROSS_COMMUNITY_STRONGER_BASIS_BONUS = 0.04;

export const CONFIDENCE_WEIGHTS = {
  dataVolume: 0.26,
  activitySpan: 0.18,
  textQuality: 0.22,
  sourceQuality: 0.18,
  coverage: 0.16,
} as const;
