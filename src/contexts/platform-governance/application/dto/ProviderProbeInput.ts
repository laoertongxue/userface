import type { GovernanceMode } from '@/src/contexts/platform-governance/domain/value-objects/GovernanceMode';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export const providerProbeTargetValues = ['disabled', 'rule-only', 'minimax'] as const;

export type ProviderProbeTarget = (typeof providerProbeTargetValues)[number];

export type ProviderProbeInput = {
  provider: ProviderProbeTarget;
  timeoutMs: number;
  governanceMode: GovernanceMode;
  observability?: ObservabilityContext;
};
