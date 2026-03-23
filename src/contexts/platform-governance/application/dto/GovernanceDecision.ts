import type { AbuseSignal } from '@/src/contexts/platform-governance/domain/entities/AbuseSignal';

export type GovernanceErrorCode =
  | 'GOVERNANCE_PAYLOAD_TOO_LARGE'
  | 'GOVERNANCE_TOO_MANY_ACCOUNTS'
  | 'GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS'
  | 'GOVERNANCE_RATE_LIMITED'
  | 'GOVERNANCE_CLUSTER_COMPLEXITY_EXCEEDED'
  | 'GOVERNANCE_NARRATIVE_DISABLED';

export type GovernanceDecision = {
  allowed: boolean;
  degraded: boolean;
  disableNarrative: boolean;
  abuseSignals: AbuseSignal[];
  errorCode?: GovernanceErrorCode;
  httpStatus?: number;
  retryAfterSeconds?: number;
  message?: string;
  complexityScore?: number;
};
