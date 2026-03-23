import type { HealthStatus } from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';

export const healthProbeTargetTypeValues = ['connector', 'provider', 'runtime'] as const;

export type HealthProbeTargetType = (typeof healthProbeTargetTypeValues)[number];

export type HealthProbeResult = {
  targetType: HealthProbeTargetType;
  targetId: string;
  status: HealthStatus;
  checkedAt: string;
  durationMs: number;
  success: boolean;
  degraded: boolean;
  errorCode?: string;
  message?: string;
  warnings?: string[];
};

export function createHealthProbeResult(input: HealthProbeResult): HealthProbeResult {
  return {
    ...input,
    targetId: input.targetId.trim(),
    message: input.message?.trim() || undefined,
    warnings: [...new Set((input.warnings ?? []).map((warning) => warning.trim()).filter(Boolean))].sort(),
  };
}
