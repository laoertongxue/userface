import type { HealthStatus } from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';

export type ProviderHealthSnapshot = {
  provider: string;
  status: HealthStatus;
  lastCheckedAt?: string;
  latencyMs?: number;
  timeoutRate?: number;
  invalidResponseRate?: number;
  warnings: string[];
};

export function createProviderHealthSnapshot(
  input: ProviderHealthSnapshot,
): ProviderHealthSnapshot {
  if (!input.provider.trim()) {
    throw new Error('ProviderHealthSnapshot.provider must not be empty.');
  }

  return {
    ...input,
    provider: input.provider.trim(),
    warnings: [...new Set(input.warnings.map((warning) => warning.trim()).filter(Boolean))].sort(),
  };
}
