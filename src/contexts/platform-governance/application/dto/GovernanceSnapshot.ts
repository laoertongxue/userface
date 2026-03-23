import type { AbuseSignal } from '@/src/contexts/platform-governance/domain/entities/AbuseSignal';
import type { ConnectorHealthSnapshot } from '@/src/contexts/platform-governance/domain/entities/ConnectorHealthSnapshot';
import type { ProviderHealthSnapshot } from '@/src/contexts/platform-governance/domain/entities/ProviderHealthSnapshot';
import type { ReleaseReadiness } from '@/src/contexts/platform-governance/domain/entities/ReleaseReadiness';
import type { RequestBudget } from '@/src/contexts/platform-governance/domain/entities/RequestBudget';
import type { RuntimeExecutionPolicy } from '@/src/contexts/platform-governance/domain/entities/RuntimeExecutionPolicy';
import type { GovernanceMode } from '@/src/contexts/platform-governance/domain/value-objects/GovernanceMode';

export type GovernanceSnapshot = {
  mode: GovernanceMode;
  executionPolicy?: RuntimeExecutionPolicy;
  requestBudget?: RequestBudget;
  abuseSignals?: AbuseSignal[];
  connectorHealth?: ConnectorHealthSnapshot[];
  providerHealth?: ProviderHealthSnapshot[];
  releaseReadiness?: ReleaseReadiness;
};

export function createGovernanceSnapshot(
  input: GovernanceSnapshot,
): GovernanceSnapshot {
  return {
    ...input,
    abuseSignals: input.abuseSignals ? [...input.abuseSignals] : undefined,
    connectorHealth: input.connectorHealth ? [...input.connectorHealth] : undefined,
    providerHealth: input.providerHealth ? [...input.providerHealth] : undefined,
  };
}
