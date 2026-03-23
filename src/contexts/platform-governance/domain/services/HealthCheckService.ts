import { HealthAggregationService } from '@/src/contexts/platform-governance/domain/services/HealthAggregationService';
import { ConnectorProbeService } from '@/src/contexts/platform-governance/domain/services/ConnectorProbeService';
import { ProviderProbeService } from '@/src/contexts/platform-governance/domain/services/ProviderProbeService';
import { RuntimeSelfCheckService } from '@/src/contexts/platform-governance/domain/services/RuntimeSelfCheckService';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export class HealthCheckService {
  constructor(
    private readonly connectorProbeService: ConnectorProbeService = new ConnectorProbeService(),
    private readonly providerProbeService: ProviderProbeService = new ProviderProbeService(),
    private readonly runtimeSelfCheckService: RuntimeSelfCheckService = new RuntimeSelfCheckService(),
    private readonly aggregationService: HealthAggregationService = new HealthAggregationService(),
  ) {}

  async checkConnectors(input: { observability?: ObservabilityContext } = {}) {
    const results = await this.connectorProbeService.probeDefaultTargets({
      observability: input.observability,
    });

    return this.aggregationService.aggregateConnectorResults(results);
  }

  async checkNarrative(input: { observability?: ObservabilityContext } = {}) {
    const results = await this.providerProbeService.probeDefaultTargets({
      observability: input.observability,
    });

    return this.aggregationService.aggregateProviderResults(results);
  }

  checkRuntime(input: { observability?: ObservabilityContext } = {}) {
    return this.runtimeSelfCheckService.execute({
      observability: input.observability,
    });
  }

  async checkAll(input: { observability?: ObservabilityContext } = {}) {
    const connectorHealth = await this.checkConnectors({
      observability: input.observability?.child('health.connectors'),
    });
    const narrativeHealth = await this.checkNarrative({
      observability: input.observability?.child('health.narrative'),
    });
    const runtimeHealth = this.checkRuntime({
      observability: input.observability?.child('health.runtime'),
    });
    const status = this.aggregationService.aggregateOverall({
      connectorStatus: connectorHealth.status,
      providerStatus: narrativeHealth.status,
      runtimeStatus: runtimeHealth.status,
    });
    const checkedAt = [
      connectorHealth.checkedAt,
      narrativeHealth.checkedAt,
      runtimeHealth.checkedAt,
    ].sort((left, right) => right.localeCompare(left))[0] ?? new Date().toISOString();
    const warnings = [
      ...connectorHealth.warnings,
      ...narrativeHealth.warnings,
      ...runtimeHealth.warnings,
    ];

    input.observability?.logger.event(observabilityEvents.healthCronProbeCompleted, {
      level: status === 'HEALTHY' ? 'info' : 'warn',
      message: 'Health probe sweep completed.',
      context: {
        targetType: 'runtime',
        targetId: 'all',
        status,
        connectorStatus: connectorHealth.status,
        providerStatus: narrativeHealth.status,
        runtimeStatus: runtimeHealth.status,
      },
    });
    input.observability?.metrics.counter(metricNames.healthCronProbeTotal, 1, {
      targetType: 'runtime',
      targetId: 'all',
      status,
      outcome: status === 'HEALTHY' ? 'success' : status === 'DEGRADED' ? 'degraded' : 'failure',
    });

    return {
      status,
      checkedAt,
      connectors: connectorHealth,
      narrative: narrativeHealth,
      runtime: runtimeHealth,
      warnings: [...new Set(warnings)].sort(),
    };
  }
}
