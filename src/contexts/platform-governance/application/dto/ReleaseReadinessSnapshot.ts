import type { FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';
import type { HealthStatus } from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';

export type ReleaseReadinessSnapshot = {
  ready: boolean;
  mode: ReleaseSafetyMode;
  blockers: string[];
  warnings: string[];
  activeSwitches: FeatureSwitchKey[];
  checkedAt: string;
  connectorStatus?: HealthStatus;
  providerStatus?: HealthStatus;
  runtimeStatus?: HealthStatus;
};
