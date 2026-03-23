import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { HealthStatus } from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';

export type ConnectorHealthSnapshot = {
  community: CommunityId;
  status: HealthStatus;
  lastCheckedAt?: string;
  latencyMs?: number;
  successRate?: number;
  warnings: string[];
  degraded: boolean;
};

export function createConnectorHealthSnapshot(
  input: ConnectorHealthSnapshot,
): ConnectorHealthSnapshot {
  return {
    ...input,
    warnings: [...new Set(input.warnings.map((warning) => warning.trim()).filter(Boolean))].sort(),
  };
}
