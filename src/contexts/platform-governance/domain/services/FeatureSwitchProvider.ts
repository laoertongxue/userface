import type { FeatureSwitchSnapshot } from '@/src/contexts/platform-governance/domain/entities/FeatureSwitchSnapshot';
import type { IncidentState } from '@/src/contexts/platform-governance/domain/entities/IncidentState';
import type { FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';

export interface FeatureSwitchProvider {
  isEnabled(key: FeatureSwitchKey): boolean;
  snapshot(): FeatureSwitchSnapshot[];
  getSafetyMode(): ReleaseSafetyMode;
  getIncidentState(): IncidentState;
}

export type RuntimeSwitchProvider = FeatureSwitchProvider;
