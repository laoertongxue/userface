import type { DegradationPlan } from '@/src/contexts/platform-governance/domain/entities/DegradationPlan';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';

export const releaseReasonCodeValues = [
  'RELEASE_ANALYZE_DISABLED',
  'RELEASE_CLUSTER_DISABLED',
  'RELEASE_SUGGEST_DISABLED',
  'RELEASE_NARRATIVE_DISABLED',
  'RELEASE_MINIMAX_DISABLED',
  'RELEASE_DEGRADED_FORCE_RULE_ONLY',
  'RELEASE_INCIDENT_CLUSTER_DISABLED',
  'RELEASE_INCIDENT_SUGGEST_DISABLED',
  'RELEASE_INCIDENT_FORCE_RULE_ONLY',
  'RELEASE_INCIDENT_NARRATIVE_DISABLED',
] as const;

export type ReleaseReasonCode = (typeof releaseReasonCodeValues)[number];

export type ReleaseGuardDecision = {
  allowed: boolean;
  mode: ReleaseSafetyMode;
  degradationPlan: DegradationPlan;
  reasonCodes: ReleaseReasonCode[];
  httpStatus?: number;
  warnings?: string[];
};
