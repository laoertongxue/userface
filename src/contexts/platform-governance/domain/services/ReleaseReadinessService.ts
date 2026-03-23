import type { ReleaseReadinessSnapshot } from '@/src/contexts/platform-governance/application/dto/ReleaseReadinessSnapshot';
import type { FeatureSwitchSnapshot } from '@/src/contexts/platform-governance/domain/entities/FeatureSwitchSnapshot';
import type { IncidentState } from '@/src/contexts/platform-governance/domain/entities/IncidentState';
import type { HealthStatus } from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

type ReleaseReadinessInput = {
  mode: ReleaseSafetyMode;
  switches: FeatureSwitchSnapshot[];
  incident: IncidentState;
  connectorStatus?: HealthStatus;
  providerStatus?: HealthStatus;
  runtimeStatus?: HealthStatus;
  observability?: ObservabilityContext;
};

export class ReleaseReadinessService {
  evaluate(input: ReleaseReadinessInput): ReleaseReadinessSnapshot {
    const observability = input.observability?.child('release.readiness');
    const blockers: string[] = [];
    const warnings: string[] = [];
    const readinessVisibleSwitches = new Set([
      'ANALYZE_ENABLED',
      'CLUSTER_ANALYSIS_ENABLED',
      'SUGGEST_ENABLED',
      'NARRATIVE_ENABLED',
      'MINIMAX_ENABLED',
      'HEALTH_PROBES_ENABLED',
    ]);
    const activeSwitches = [...new Set([
      ...input.switches
        .filter((item) => !item.enabled && readinessVisibleSwitches.has(item.key))
        .map((item) => item.key),
      ...input.incident.activeSwitches.filter((key) => readinessVisibleSwitches.has(key)),
    ])].sort();

    if (input.incident.active || input.mode === 'INCIDENT') {
      blockers.push('incident-active');
      observability?.logger.event(observabilityEvents.incidentModeActive, {
        level: 'warn',
        message: 'Incident mode is active during release readiness evaluation.',
        context: {
          mode: input.mode,
          incidentSeverity: input.incident.severity,
        },
      });
    }

    if (input.mode === 'DEGRADED') {
      warnings.push('release-safety-degraded');
    }

    if (!input.switches.find((item) => item.key === 'ANALYZE_ENABLED')?.enabled) {
      blockers.push('analyze-disabled');
    }

    if (input.runtimeStatus === 'UNHEALTHY') {
      blockers.push('runtime-unhealthy');
    } else if (input.runtimeStatus === 'DEGRADED') {
      warnings.push('runtime-degraded');
    }

    if (input.connectorStatus === 'UNHEALTHY') {
      blockers.push('connectors-unhealthy');
    } else if (input.connectorStatus === 'DEGRADED' || input.connectorStatus === 'UNKNOWN') {
      warnings.push('connectors-degraded');
    }

    if (input.providerStatus === 'UNHEALTHY' || input.providerStatus === 'DEGRADED' || input.providerStatus === 'UNKNOWN') {
      warnings.push('narrative-provider-degraded');
    }

    if (!input.switches.find((item) => item.key === 'SUGGEST_ENABLED')?.enabled) {
      warnings.push('suggest-disabled');
    }

    if (!input.switches.find((item) => item.key === 'CLUSTER_ANALYSIS_ENABLED')?.enabled) {
      warnings.push('cluster-analysis-disabled');
    }

    const checkedAt = new Date().toISOString();
    const snapshot: ReleaseReadinessSnapshot = {
      ready: blockers.length === 0,
      mode: input.mode,
      blockers: [...new Set(blockers)].sort(),
      warnings: [...new Set(warnings)].sort(),
      activeSwitches,
      checkedAt,
      connectorStatus: input.connectorStatus,
      providerStatus: input.providerStatus,
      runtimeStatus: input.runtimeStatus,
    };

    observability?.logger.event(observabilityEvents.releaseReadinessEvaluated, {
      level: snapshot.ready ? 'info' : 'warn',
      message: 'Release readiness evaluated.',
      context: {
        mode: input.mode,
        ready: snapshot.ready,
        blockersCount: snapshot.blockers.length,
        warningsCount: snapshot.warnings.length,
        incidentSeverity: input.incident.severity,
      },
    });
    if (!snapshot.ready) {
      observability?.metrics.counter(metricNames.releaseReadinessNotReadyTotal, 1, {
        mode: input.mode,
        reasonCode: snapshot.blockers[0] ?? 'not-ready',
        incidentSeverity: input.incident.severity,
      });
    }

    return snapshot;
  }
}
