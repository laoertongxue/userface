import type { FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';
import type { IncidentSeverity } from '@/src/contexts/platform-governance/domain/value-objects/IncidentSeverity';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';

export type IncidentState = {
  active: boolean;
  severity: IncidentSeverity;
  mode: ReleaseSafetyMode;
  reason: string;
  startedAt?: string;
  activeSwitches: FeatureSwitchKey[];
};

export function createIncidentState(input: IncidentState): IncidentState {
  return {
    ...input,
    reason: input.reason.trim(),
    startedAt: input.startedAt?.trim() || undefined,
    activeSwitches: [...new Set(input.activeSwitches)].sort(),
  };
}
