import type { ExternalAccountRef } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { GovernanceMode } from '@/src/contexts/platform-governance/domain/value-objects/GovernanceMode';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export type ConnectorProbeInput = {
  community: ExternalAccountRef['community'];
  ref: ExternalAccountRef;
  timeoutMs: number;
  governanceMode: GovernanceMode;
  observability?: ObservabilityContext;
};
