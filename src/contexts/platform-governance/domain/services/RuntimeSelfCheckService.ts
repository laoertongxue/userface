import { env } from '@/src/config/env';
import {
  createHealthProbeResult,
  type HealthProbeResult,
} from '@/src/contexts/platform-governance/application/dto/HealthProbeResult';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';
import { readNarrativeGatewayConfig, type NarrativeGatewayEnvSource } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

type RuntimeSelfCheckEnvSource = NarrativeGatewayEnvSource & {
  HEALTH_PROBE_CRON_TOKEN?: string;
  CRON_SECRET?: string;
};

export type RuntimeSelfCheckResult = {
  status: HealthProbeResult['status'];
  checkedAt: string;
  targets: HealthProbeResult[];
  warnings: string[];
  blockers: string[];
};

export class RuntimeSelfCheckService {
  execute(input: {
    source?: RuntimeSelfCheckEnvSource;
    observability?: ObservabilityContext;
  } = {}): RuntimeSelfCheckResult {
    const source = input.source ?? env;
    const observability = input.observability?.child('health.runtime');
    const span = observability?.startSpan('health.runtime');
    const checkedAt = new Date().toISOString();
    const warnings: string[] = [];
    const blockers: string[] = [];
    const results: HealthProbeResult[] = [];

    const governanceReady = Boolean(platformPolicies.requestGovernance && platformPolicies.requestTimeoutMs > 0);
    results.push(
      createHealthProbeResult({
        targetType: 'runtime',
        targetId: 'governance.bootstrap',
        status: governanceReady ? 'HEALTHY' : 'UNHEALTHY',
        checkedAt,
        durationMs: 0,
        success: governanceReady,
        degraded: false,
        message: governanceReady
          ? 'Governance policy objects can be created.'
          : 'Governance policy bootstrap failed.',
      }),
    );

    try {
      new ObservabilityContext({
        trace: {
          traceId: 'trace-runtime-health',
          requestId: 'request-runtime-health',
          route: '/api/health/runtime',
          operation: 'health.runtime',
          startedAt: checkedAt,
        },
      });
      results.push(
        createHealthProbeResult({
          targetType: 'runtime',
          targetId: 'observability.bootstrap',
          status: 'HEALTHY',
          checkedAt,
          durationMs: 0,
          success: true,
          degraded: false,
          message: 'Observability context can be created.',
        }),
      );
    } catch {
      blockers.push('observability-bootstrap-failed');
      results.push(
        createHealthProbeResult({
          targetType: 'runtime',
          targetId: 'observability.bootstrap',
          status: 'UNHEALTHY',
          checkedAt,
          durationMs: 0,
          success: false,
          degraded: false,
          errorCode: 'INTERNAL_ERROR',
          message: 'Observability bootstrap failed.',
        }),
      );
    }

    const narrativeConfig = readNarrativeGatewayConfig(source);
    if (narrativeConfig.provider === 'minimax' && !narrativeConfig.minimax.isConfigured) {
      blockers.push('narrative-provider-config-missing');
      results.push(
        createHealthProbeResult({
          targetType: 'runtime',
          targetId: 'narrative.config',
          status: 'UNHEALTHY',
          checkedAt,
          durationMs: 0,
          success: false,
          degraded: false,
          errorCode: 'CONFIG_ERROR',
          message: 'Narrative provider is set to minimax but required config is missing.',
          warnings: ['narrative-provider-misconfigured'],
        }),
      );
    } else {
      results.push(
        createHealthProbeResult({
          targetType: 'runtime',
          targetId: 'narrative.config',
          status: 'HEALTHY',
          checkedAt,
          durationMs: 0,
          success: true,
          degraded: false,
          message: 'Narrative provider configuration is internally consistent.',
        }),
      );
    }

    const cronConfigured = Boolean(
      source.HEALTH_PROBE_CRON_TOKEN?.trim() || source.CRON_SECRET?.trim(),
    );
    if (!cronConfigured) {
      warnings.push('health-probe-cron-token-missing');
    }
    results.push(
      createHealthProbeResult({
        targetType: 'runtime',
        targetId: 'cron.auth',
        status: cronConfigured ? 'HEALTHY' : 'DEGRADED',
        checkedAt,
        durationMs: 0,
        success: cronConfigured,
        degraded: !cronConfigured,
        message: cronConfigured
          ? 'Cron probe token is configured.'
          : 'Cron probe token is missing, so scheduled probes cannot be protected yet.',
        warnings: cronConfigured ? [] : ['cron-auth-missing'],
      }),
    );

    const status = blockers.length > 0
      ? 'UNHEALTHY'
      : warnings.length > 0
        ? 'DEGRADED'
        : 'HEALTHY';
    const completedSpan = span?.finish(status === 'HEALTHY' ? 'success' : status === 'DEGRADED' ? 'partial' : 'failure');

    observability?.logger.event(observabilityEvents.healthRuntimeCheckCompleted, {
      level: status === 'HEALTHY' ? 'info' : 'warn',
      message: 'Runtime self-check completed.',
      context: {
        targetType: 'runtime',
        targetId: 'runtime',
        status,
        warningsCount: warnings.length,
        blockersCount: blockers.length,
        durationMs: completedSpan?.durationMs ?? 0,
      },
    });
    observability?.metrics.counter(metricNames.healthRuntimeCheckTotal, 1, {
      targetType: 'runtime',
      targetId: 'runtime',
      status,
      outcome: status === 'HEALTHY' ? 'success' : status === 'DEGRADED' ? 'degraded' : 'failure',
    });
    if (completedSpan) {
      observability?.metrics.timing(metricNames.healthRuntimeCheckDurationMs, completedSpan.durationMs, {
        targetType: 'runtime',
        targetId: 'runtime',
        status,
        outcome: status === 'HEALTHY' ? 'success' : status === 'DEGRADED' ? 'degraded' : 'failure',
      });
    }

    return {
      status,
      checkedAt,
      targets: results,
      warnings: [...new Set(warnings)].sort(),
      blockers: [...new Set(blockers)].sort(),
    };
  }
}
