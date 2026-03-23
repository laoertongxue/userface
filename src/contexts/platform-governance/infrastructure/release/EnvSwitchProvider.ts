import { env } from '@/src/config/env';
import {
  createFeatureSwitchSnapshot,
  type FeatureSwitchSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/FeatureSwitchSnapshot';
import {
  createIncidentState,
  type IncidentState,
} from '@/src/contexts/platform-governance/domain/entities/IncidentState';
import type { FeatureSwitchProvider } from '@/src/contexts/platform-governance/domain/services/FeatureSwitchProvider';
import type { FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';
import type { IncidentSeverity } from '@/src/contexts/platform-governance/domain/value-objects/IncidentSeverity';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';

export type EnvSwitchSource = {
  FEATURE_ANALYZE_ENABLED?: string;
  FEATURE_CLUSTER_ANALYSIS_ENABLED?: string;
  FEATURE_SUGGEST_ENABLED?: string;
  FEATURE_NARRATIVE_ENABLED?: string;
  FEATURE_MINIMAX_ENABLED?: string;
  FEATURE_HEALTH_PROBES_ENABLED?: string;
  FEATURE_STRICT_GOVERNANCE_ENABLED?: string;
  RELEASE_SAFETY_MODE?: string;
  INCIDENT_ACTIVE?: string;
  INCIDENT_SEVERITY?: string;
  INCIDENT_REASON?: string;
  INCIDENT_STARTED_AT?: string;
};

type SwitchConfig = {
  envKey: keyof EnvSwitchSource;
  key: FeatureSwitchKey;
  defaultEnabled: boolean;
};

const SWITCH_CONFIGS: SwitchConfig[] = [
  { envKey: 'FEATURE_ANALYZE_ENABLED', key: 'ANALYZE_ENABLED', defaultEnabled: true },
  { envKey: 'FEATURE_CLUSTER_ANALYSIS_ENABLED', key: 'CLUSTER_ANALYSIS_ENABLED', defaultEnabled: true },
  { envKey: 'FEATURE_SUGGEST_ENABLED', key: 'SUGGEST_ENABLED', defaultEnabled: true },
  { envKey: 'FEATURE_NARRATIVE_ENABLED', key: 'NARRATIVE_ENABLED', defaultEnabled: true },
  { envKey: 'FEATURE_MINIMAX_ENABLED', key: 'MINIMAX_ENABLED', defaultEnabled: true },
  { envKey: 'FEATURE_HEALTH_PROBES_ENABLED', key: 'HEALTH_PROBES_ENABLED', defaultEnabled: true },
  { envKey: 'FEATURE_STRICT_GOVERNANCE_ENABLED', key: 'STRICT_GOVERNANCE_ENABLED', defaultEnabled: false },
];

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function normalizeMode(value: string | undefined): ReleaseSafetyMode {
  if (value === 'DEGRADED' || value === 'INCIDENT') {
    return value;
  }

  return 'NORMAL';
}

function normalizeSeverity(value: string | undefined): IncidentSeverity {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') {
    return value;
  }

  return 'INFO';
}

export class EnvSwitchProvider implements FeatureSwitchProvider {
  constructor(private readonly source: EnvSwitchSource = env as EnvSwitchSource) {}

  snapshot(): FeatureSwitchSnapshot[] {
    return SWITCH_CONFIGS.map((config) => {
      const configured = parseBoolean(this.source[config.envKey]);

      return createFeatureSwitchSnapshot({
        key: config.key,
        enabled: configured ?? config.defaultEnabled,
        source: configured === undefined ? 'default' : 'env',
        reason:
          configured === undefined
            ? `default:${config.defaultEnabled ? 'enabled' : 'disabled'}`
            : `env:${configured ? 'enabled' : 'disabled'}`,
      });
    }).sort((left, right) => left.key.localeCompare(right.key));
  }

  isEnabled(key: FeatureSwitchKey): boolean {
    return this.snapshot().find((item) => item.key === key)?.enabled ?? false;
  }

  getSafetyMode(): ReleaseSafetyMode {
    return normalizeMode(this.source.RELEASE_SAFETY_MODE);
  }

  getIncidentState(): IncidentState {
    const active = parseBoolean(this.source.INCIDENT_ACTIVE) ?? false;
    const severity = normalizeSeverity(this.source.INCIDENT_SEVERITY);
    const baseMode = this.getSafetyMode();
    const mode = active ? 'INCIDENT' : baseMode;
    const snapshots = this.snapshot();
    const activeSwitches = snapshots
      .filter((snapshot) => !snapshot.enabled)
      .map((snapshot) => snapshot.key);

    if (active) {
      activeSwitches.push('SUGGEST_ENABLED', 'CLUSTER_ANALYSIS_ENABLED');

      if (severity === 'HIGH' || severity === 'CRITICAL') {
        activeSwitches.push('NARRATIVE_ENABLED');
      }
    }

    return createIncidentState({
      active,
      severity,
      mode,
      reason: this.source.INCIDENT_REASON?.trim() || (active ? 'incident-mode-active' : 'none'),
      startedAt: this.source.INCIDENT_STARTED_AT?.trim() || undefined,
      activeSwitches: [...new Set(activeSwitches)],
    });
  }
}
