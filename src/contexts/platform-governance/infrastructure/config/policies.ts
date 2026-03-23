import { requestGovernancePolicy } from '@/src/contexts/platform-governance/domain/services/RequestGovernancePolicy';
import { HEALTH_PROBE_POLICY } from '@/src/contexts/platform-governance/infrastructure/health/ProbePolicy';

export const platformPolicies = {
  requestTimeoutMs: 25_000,
  treatPartialResultsAsSuccess: true,
  requestGovernance: requestGovernancePolicy,
  health: HEALTH_PROBE_POLICY,
};
