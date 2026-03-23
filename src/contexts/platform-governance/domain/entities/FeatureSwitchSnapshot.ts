import type { FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';

export type FeatureSwitchSnapshot = {
  key: FeatureSwitchKey;
  enabled: boolean;
  source: 'env' | 'default' | 'provider';
  reason?: string;
};

export function createFeatureSwitchSnapshot(
  input: FeatureSwitchSnapshot,
): FeatureSwitchSnapshot {
  return {
    ...input,
    reason: input.reason?.trim() || undefined,
  };
}
