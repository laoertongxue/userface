import {
  createConnectorHealthSnapshot,
  type ConnectorHealthSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/ConnectorHealthSnapshot';
import {
  createProviderHealthSnapshot,
  type ProviderHealthSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/ProviderHealthSnapshot';
import type { HealthProbeResult } from '@/src/contexts/platform-governance/application/dto/HealthProbeResult';
import type { HealthStatus } from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';
import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

type AggregatedConnectors = {
  status: HealthStatus;
  targets: ConnectorHealthSnapshot[];
  warnings: string[];
  checkedAt: string;
};

type AggregatedProviders = {
  status: HealthStatus;
  targets: ProviderHealthSnapshot[];
  warnings: string[];
  checkedAt: string;
};

type AggregatedRuntime = {
  status: HealthStatus;
  targets: HealthProbeResult[];
  warnings: string[];
  blockers: string[];
  checkedAt: string;
};

function uniqueWarnings(results: Array<{ warnings?: string[] }>): string[] {
  return [...new Set(results.flatMap((result) => result.warnings ?? []).filter(Boolean))].sort();
}

function aggregateStatuses(statuses: HealthStatus[]): HealthStatus {
  if (statuses.length === 0) {
    return 'UNKNOWN';
  }

  if (statuses.every((status) => status === 'UNKNOWN')) {
    return 'UNKNOWN';
  }

  if (statuses.some((status) => status === 'UNHEALTHY')) {
    return 'UNHEALTHY';
  }

  if (statuses.some((status) => status === 'DEGRADED')) {
    return 'DEGRADED';
  }

  if (statuses.some((status) => status === 'UNKNOWN')) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

function latestCheckedAt(results: HealthProbeResult[]): string {
  return results
    .map((result) => result.checkedAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? new Date().toISOString();
}

export class HealthAggregationService {
  aggregateConnectorResults(results: HealthProbeResult[]): AggregatedConnectors {
    const targets = results
      .map((result) =>
        createConnectorHealthSnapshot({
          community: result.targetId as CommunityId,
          status: result.status,
          lastCheckedAt: result.checkedAt,
          latencyMs: result.durationMs,
          successRate: result.success ? 1 : 0,
          warnings: result.warnings ?? [],
          degraded: result.degraded,
        }),
      )
      .sort((left, right) => left.community.localeCompare(right.community));

    return {
      status: aggregateStatuses(targets.map((target) => target.status)),
      targets,
      warnings: uniqueWarnings(targets),
      checkedAt: latestCheckedAt(results),
    };
  }

  aggregateProviderResults(results: HealthProbeResult[]): AggregatedProviders {
    const targets = results
      .map((result) =>
        createProviderHealthSnapshot({
          provider: result.targetId,
          status: result.status,
          lastCheckedAt: result.checkedAt,
          latencyMs: result.durationMs,
          timeoutRate: result.errorCode === 'NARRATIVE_TIMEOUT' ? 1 : 0,
          invalidResponseRate: result.errorCode === 'NARRATIVE_INVALID_RESPONSE' ? 1 : 0,
          warnings: result.warnings ?? [],
        }),
      )
      .sort((left, right) => left.provider.localeCompare(right.provider));

    const minimax = targets.find((target) => target.provider === 'minimax');
    const fallbackAvailable = targets.some(
      (target) =>
        (target.provider === 'disabled' || target.provider === 'rule-only') &&
        target.status === 'HEALTHY',
    );

    let status = aggregateStatuses(targets.map((target) => target.status));

    if (minimax && minimax.status !== 'HEALTHY' && fallbackAvailable) {
      status = minimax.status === 'UNKNOWN' && targets.every((target) => target.status === 'UNKNOWN')
        ? 'UNKNOWN'
        : 'DEGRADED';
    }

    return {
      status,
      targets,
      warnings: uniqueWarnings(targets),
      checkedAt: latestCheckedAt(results),
    };
  }

  aggregateRuntimeResults(
    results: HealthProbeResult[],
    input: { blockers?: string[] } = {},
  ): AggregatedRuntime {
    const blockers = [...new Set((input.blockers ?? []).filter(Boolean))];
    const status = blockers.length > 0
      ? 'UNHEALTHY'
      : aggregateStatuses(results.map((result) => result.status));

    return {
      status,
      targets: [...results].sort((left, right) => left.targetId.localeCompare(right.targetId)),
      warnings: uniqueWarnings(results),
      blockers: blockers.sort(),
      checkedAt: latestCheckedAt(results),
    };
  }

  aggregateOverall(input: {
    connectorStatus: HealthStatus;
    providerStatus: HealthStatus;
    runtimeStatus: HealthStatus;
  }): HealthStatus {
    return aggregateStatuses([
      input.connectorStatus,
      input.providerStatus,
      input.runtimeStatus,
    ]);
  }
}
