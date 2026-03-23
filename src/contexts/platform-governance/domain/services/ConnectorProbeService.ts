import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import type { ConnectorWarning } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import type { ConnectorProbeInput } from '@/src/contexts/platform-governance/application/dto/ConnectorProbeInput';
import {
  createHealthProbeResult,
  type HealthProbeResult,
} from '@/src/contexts/platform-governance/application/dto/HealthProbeResult';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

function mapConnectorProbeStatus(result: { ok: boolean; warnings: ConnectorWarning[] }): {
  status: HealthProbeResult['status'];
  degraded: boolean;
  success: boolean;
  errorCode?: string;
} {
  const codes = result.warnings.map((warning) => warning.code);

  if (result.ok && codes.length === 0) {
    return {
      status: 'HEALTHY',
      degraded: false,
      success: true,
    };
  }

  if (codes.some((code) => code === 'LOGIN_REQUIRED' || code === 'UNSUPPORTED' || code === 'NOT_FOUND')) {
    return {
      status: 'UNKNOWN',
      degraded: false,
      success: false,
      errorCode: normalizeErrorCode({ warningCode: codes[0] }),
    };
  }

  if (codes.some((code) => code === 'RATE_LIMITED' || code === 'SELECTOR_CHANGED' || code === 'PARTIAL_RESULT' || code === 'TOPICS_HIDDEN')) {
    return {
      status: 'DEGRADED',
      degraded: true,
      success: result.ok,
      errorCode: normalizeErrorCode({ warningCode: codes[0] }),
    };
  }

  return {
    status: result.ok ? 'DEGRADED' : 'UNHEALTHY',
    degraded: !result.ok,
    success: result.ok,
    errorCode: codes[0] ? normalizeErrorCode({ warningCode: codes[0] }) : 'INTERNAL_ERROR',
  };
}

export class ConnectorProbeService {
  constructor(private readonly registry: ConnectorRegistry = new StaticConnectorRegistry()) {}

  async probe(input: ConnectorProbeInput): Promise<HealthProbeResult> {
    const observability = input.observability?.child(`health.connector.${input.community}`);
    const span = observability?.startSpan(`health.connector.${input.community}`);
    observability?.logger.event(observabilityEvents.healthConnectorProbeStarted, {
      message: 'Connector health probe started.',
      context: {
        targetType: 'connector',
        targetId: input.community,
        community: input.community,
      },
    });

    try {
      const connector = this.registry.get(input.community);
      const result = await connector.probe(input.ref, {
        traceId: input.observability?.trace.traceId ?? crypto.randomUUID(),
        timeoutMs: input.timeoutMs,
        locale: 'zh-CN',
        observability: observability?.child('connector.probe'),
      });
      const completedSpan = span?.finish(result.ok ? 'success' : 'partial');
      const mapped = mapConnectorProbeStatus(result);
      const probeResult = createHealthProbeResult({
        targetType: 'connector',
        targetId: input.community,
        status: mapped.status,
        checkedAt: new Date().toISOString(),
        durationMs: completedSpan?.durationMs ?? 0,
        success: mapped.success,
        degraded: mapped.degraded,
        errorCode: mapped.errorCode,
        message: result.warnings[0]?.message,
        warnings: result.warnings.map((warning) => warning.code),
      });

      observability?.logger.event(observabilityEvents.healthConnectorProbeCompleted, {
        message: 'Connector health probe completed.',
        errorCode: mapped.errorCode as never,
        context: {
          targetType: 'connector',
          targetId: input.community,
          community: input.community,
          status: probeResult.status,
          outcome: probeResult.success ? 'success' : probeResult.degraded ? 'degraded' : 'failure',
          warningsCount: probeResult.warnings?.length ?? 0,
          durationMs: probeResult.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.healthConnectorProbeTotal, 1, {
        targetType: 'connector',
        targetId: input.community,
        community: input.community,
        status: probeResult.status,
        outcome: probeResult.success ? 'success' : probeResult.degraded ? 'degraded' : 'failure',
      });
      observability?.metrics.timing(metricNames.healthConnectorProbeDurationMs, probeResult.durationMs, {
        targetType: 'connector',
        targetId: input.community,
        community: input.community,
        status: probeResult.status,
        outcome: probeResult.success ? 'success' : probeResult.degraded ? 'degraded' : 'failure',
      });

      return probeResult;
    } catch (error) {
      const failedSpan = span?.finish('failure');
      const probeResult = createHealthProbeResult({
        targetType: 'connector',
        targetId: input.community,
        status: 'UNHEALTHY',
        checkedAt: new Date().toISOString(),
        durationMs: failedSpan?.durationMs ?? 0,
        success: false,
        degraded: false,
        errorCode: normalizeErrorCode({ error }),
        message: 'Connector health probe failed unexpectedly.',
        warnings: [],
      });

      observability?.logger.event(observabilityEvents.healthConnectorProbeFailed, {
        level: 'error',
        message: 'Connector health probe failed.',
        errorCode: normalizeErrorCode({ error }),
        context: {
          targetType: 'connector',
          targetId: input.community,
          community: input.community,
          durationMs: probeResult.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.healthConnectorProbeTotal, 1, {
        targetType: 'connector',
        targetId: input.community,
        community: input.community,
        status: probeResult.status,
        outcome: 'failure',
      });
      observability?.metrics.timing(metricNames.healthConnectorProbeDurationMs, probeResult.durationMs, {
        targetType: 'connector',
        targetId: input.community,
        community: input.community,
        status: probeResult.status,
        outcome: 'failure',
      });

      return probeResult;
    }
  }

  async probeAll(
    inputs: ConnectorProbeInput[],
  ): Promise<HealthProbeResult[]> {
    return Promise.all(inputs.map((input) => this.probe(input)));
  }

  async probeDefaultTargets(input: {
    observability?: ConnectorProbeInput['observability'];
  } = {}): Promise<HealthProbeResult[]> {
    return this.probeAll(
      platformPolicies.health.connectorTargets.map((target) => ({
        community: target.community,
        ref: target.ref,
        timeoutMs: platformPolicies.health.connectorTimeoutMs,
        governanceMode: platformPolicies.requestGovernance.mode,
        observability: input.observability,
      })),
    );
  }
}
