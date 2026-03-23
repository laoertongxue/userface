import { describe, expect, test, vi } from 'vitest';
import type {
  AcquisitionContext,
  ConnectorProbeResult,
  ExternalAccountRef,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import { ConnectorProbeService } from '@/src/contexts/platform-governance/domain/services/ConnectorProbeService';
import { ProviderProbeService } from '@/src/contexts/platform-governance/domain/services/ProviderProbeService';
import { RuntimeSelfCheckService } from '@/src/contexts/platform-governance/domain/services/RuntimeSelfCheckService';
import { HealthAggregationService } from '@/src/contexts/platform-governance/domain/services/HealthAggregationService';
import {
  createTestObservabilityContext,
  MemoryObservabilitySink,
} from '@/src/contexts/platform-governance/__tests__/observabilityTestHelpers';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

class FakeConnector implements CommunityConnector {
  readonly mode = 'public' as const;
  readonly capabilities = {
    publicProfile: true,
    publicTopics: false,
    publicReplies: false,
    requiresAuth: false,
    supportsPagination: false,
    supportsCrossCommunityHints: false,
  };

  constructor(
    readonly community: 'v2ex' | 'guozaoke',
    private readonly probeImpl: (ref: ExternalAccountRef, ctx: AcquisitionContext) => Promise<ConnectorProbeResult>,
  ) {}

  async probe(ref: ExternalAccountRef, ctx: AcquisitionContext): Promise<ConnectorProbeResult> {
    return this.probeImpl(ref, ctx);
  }

  async fetchSnapshot() {
    return {
      ref: { community: this.community, handle: 'probe' },
      profile: null,
      activities: [],
      diagnostics: {
        fetchedPages: 0,
        fetchedItems: 0,
        elapsedMs: 0,
        degraded: true,
        usedRoutes: [],
      },
      warnings: [],
    };
  }
}

class FakeConnectorRegistry implements ConnectorRegistry {
  constructor(private readonly connectors: CommunityConnector[]) {}

  get(community: 'v2ex' | 'guozaoke' | 'weibo'): CommunityConnector {
    const connector = this.connectors.find((item) => item.community === community);

    if (!connector) {
      throw new Error(`Unknown connector: ${community}`);
    }

    return connector;
  }

  list(): CommunityConnector[] {
    return [...this.connectors];
  }
}

describe('health baseline services', () => {
  test('connector probe maps successful probe to HEALTHY', async () => {
    const service = new ConnectorProbeService(
      new FakeConnectorRegistry([
        new FakeConnector('v2ex', async (ref) => ({
          ok: true,
          community: 'v2ex',
          ref,
          resolvedUrl: 'https://www.v2ex.com/u/laoertongzhi',
          warnings: [],
        })),
      ]),
    );

    const result = await service.probe({
      community: 'v2ex',
      ref: { community: 'v2ex', handle: 'laoertongzhi' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(result).toMatchObject({
      targetType: 'connector',
      targetId: 'v2ex',
      status: 'HEALTHY',
      success: true,
      degraded: false,
    });
  });

  test('connector probe maps failed warning probe to DEGRADED', async () => {
    const service = new ConnectorProbeService(
      new FakeConnectorRegistry([
        new FakeConnector('guozaoke', async (ref) => ({
          ok: false,
          community: 'guozaoke',
          ref,
          warnings: [
            {
              code: 'PARTIAL_RESULT',
              message: 'Probe returned a partial result.',
            },
          ],
        })),
      ]),
    );

    const result = await service.probe({
      community: 'guozaoke',
      ref: { community: 'guozaoke', handle: 'tipsy_love' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(result).toMatchObject({
      targetType: 'connector',
      targetId: 'guozaoke',
      status: 'DEGRADED',
      success: false,
      degraded: true,
      errorCode: 'PARTIAL_RESULT',
    });
  });

  test('provider probe treats disabled and rule-only providers as healthy', async () => {
    const service = new ProviderProbeService({
      provider: 'none',
      timeoutMs: 1000,
      minimax: {
        isConfigured: false,
      },
    });

    const disabled = await service.probe({
      provider: 'disabled',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const ruleOnly = await service.probe({
      provider: 'rule-only',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(disabled.status).toBe('HEALTHY');
    expect(ruleOnly.status).toBe('HEALTHY');
  });

  test('provider probe maps minimax invalid response to DEGRADED', async () => {
    const service = new ProviderProbeService(
      {
        provider: 'minimax',
        timeoutMs: 1000,
        minimax: {
          apiKey: 'key',
          baseUrl: 'https://api.minimax.example/v1',
          model: 'abab-1.0-chat',
          isConfigured: true,
        },
      },
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '' } }],
          }),
          { status: 200 },
        ),
    );

    const result = await service.probe({
      provider: 'minimax',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCode).toBe('NARRATIVE_INVALID_RESPONSE');
  });

  test('provider probe maps minimax timeout to DEGRADED', async () => {
    const service = new ProviderProbeService(
      {
        provider: 'minimax',
        timeoutMs: 1000,
        minimax: {
          apiKey: 'key',
          baseUrl: 'https://api.minimax.example/v1',
          model: 'abab-1.0-chat',
          isConfigured: true,
        },
      },
      async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
    );

    const result = await service.probe({
      provider: 'minimax',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCode).toBe('NARRATIVE_TIMEOUT');
  });

  test('runtime self-check returns HEALTHY when config is complete and DEGRADED when non-critical cron auth is missing', () => {
    const service = new RuntimeSelfCheckService();

    const healthy = service.execute({
      source: {
        NARRATIVE_PROVIDER: 'none',
        HEALTH_PROBE_CRON_TOKEN: 'secret',
      },
    });
    const degraded = service.execute({
      source: {
        NARRATIVE_PROVIDER: 'none',
      },
    });

    expect(healthy.status).toBe('HEALTHY');
    expect(degraded.status).toBe('DEGRADED');
  });

  test('runtime self-check returns UNHEALTHY when minimax is enabled without required config', () => {
    const service = new RuntimeSelfCheckService();
    const result = service.execute({
      source: {
        NARRATIVE_PROVIDER: 'minimax',
      },
    });

    expect(result.status).toBe('UNHEALTHY');
    expect(result.blockers).toEqual(
      expect.arrayContaining(['narrative-provider-config-missing']),
    );
  });

  test('health aggregation applies stable connector, provider, and runtime rules', () => {
    const service = new HealthAggregationService();

    const connectors = service.aggregateConnectorResults([
      {
        targetType: 'connector',
        targetId: 'v2ex',
        status: 'HEALTHY',
        checkedAt: '2026-03-23T10:00:00.000Z',
        durationMs: 10,
        success: true,
        degraded: false,
      },
      {
        targetType: 'connector',
        targetId: 'guozaoke',
        status: 'DEGRADED',
        checkedAt: '2026-03-23T10:00:01.000Z',
        durationMs: 12,
        success: false,
        degraded: true,
        warnings: ['partial-result'],
      },
    ]);
    const providers = service.aggregateProviderResults([
      {
        targetType: 'provider',
        targetId: 'disabled',
        status: 'HEALTHY',
        checkedAt: '2026-03-23T10:00:00.000Z',
        durationMs: 1,
        success: true,
        degraded: false,
      },
      {
        targetType: 'provider',
        targetId: 'rule-only',
        status: 'HEALTHY',
        checkedAt: '2026-03-23T10:00:00.000Z',
        durationMs: 1,
        success: true,
        degraded: false,
      },
      {
        targetType: 'provider',
        targetId: 'minimax',
        status: 'UNHEALTHY',
        checkedAt: '2026-03-23T10:00:00.000Z',
        durationMs: 25,
        success: false,
        degraded: false,
      },
    ]);
    const runtime = service.aggregateRuntimeResults(
      [
        {
          targetType: 'runtime',
          targetId: 'cron.auth',
          status: 'DEGRADED',
          checkedAt: '2026-03-23T10:00:00.000Z',
          durationMs: 0,
          success: false,
          degraded: true,
        },
      ],
      { blockers: [] },
    );

    expect(connectors.status).toBe('DEGRADED');
    expect(providers.status).toBe('DEGRADED');
    expect(runtime.status).toBe('DEGRADED');
    expect(
      service.aggregateOverall({
        connectorStatus: connectors.status,
        providerStatus: providers.status,
        runtimeStatus: runtime.status,
      }),
    ).toBe('DEGRADED');
  });

  test('health observability records probe events and metrics', async () => {
    const sink = new MemoryObservabilitySink();
    const service = new ConnectorProbeService(
      new FakeConnectorRegistry([
        new FakeConnector('v2ex', async (ref) => ({
          ok: true,
          community: 'v2ex',
          ref,
          warnings: [],
        })),
      ]),
    );

    await service.probe({
      community: 'v2ex',
      ref: { community: 'v2ex', handle: 'laoertongzhi' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
      observability: createTestObservabilityContext(sink, {
        route: '/api/health/connectors',
        operation: 'health.connectors',
      }),
    });

    expect(sink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: observabilityEvents.healthConnectorProbeStarted,
        }),
        expect.objectContaining({
          event: observabilityEvents.healthConnectorProbeCompleted,
        }),
      ]),
    );
    expect(sink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: metricNames.healthConnectorProbeTotal,
        }),
        expect.objectContaining({
          name: metricNames.healthConnectorProbeDurationMs,
        }),
      ]),
    );
  });
});
