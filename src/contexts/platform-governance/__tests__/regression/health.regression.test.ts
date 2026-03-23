import { afterEach, describe, expect, test, vi } from 'vitest';
import { ConnectorProbeService } from '@/src/contexts/platform-governance/domain/services/ConnectorProbeService';
import { ProviderProbeService } from '@/src/contexts/platform-governance/domain/services/ProviderProbeService';
import { RuntimeSelfCheckService } from '@/src/contexts/platform-governance/domain/services/RuntimeSelfCheckService';
import { HealthAggregationService } from '@/src/contexts/platform-governance/domain/services/HealthAggregationService';
import { governanceGoldenCases } from '@/src/contexts/platform-governance/__tests__/regression/goldenCases';
import { FakeConnector, FakeConnectorRegistry, GOVERNANCE_TEST_TIMESTAMP } from '@/src/contexts/platform-governance/__tests__/regression/helpers';

afterEach(() => {
  delete process.env.HEALTH_PROBE_CRON_TOKEN;
  delete process.env.CRON_SECRET;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('health and probe regression', () => {
  test('connector probe maps HEALTHY, DEGRADED, UNHEALTHY, and UNKNOWN states stably', async () => {
    const service = new ConnectorProbeService(
      new FakeConnectorRegistry([
        new FakeConnector('v2ex', async (ref) => ({
          ok: true,
          community: 'v2ex',
          ref,
          resolvedUrl: 'https://www.v2ex.com/u/probe',
          warnings: [],
        })),
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

    const healthy = await service.probe({
      community: 'v2ex',
      ref: { community: 'v2ex', handle: 'probe-user' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const degraded = await service.probe({
      community: 'guozaoke',
      ref: { community: 'guozaoke', handle: 'probe-user' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const unknownService = new ConnectorProbeService(
      new FakeConnectorRegistry([
        new FakeConnector('v2ex', async (ref) => ({
          ok: false,
          community: 'v2ex',
          ref,
          warnings: [
            {
              code: 'LOGIN_REQUIRED',
              message: 'Probe requires authentication.',
            },
          ],
        })),
      ]),
    );
    const unhealthyService = new ConnectorProbeService(
      new FakeConnectorRegistry([
        new FakeConnector('v2ex', async () => {
          throw new Error('probe failed');
        }),
      ]),
    );

    const unknown = await unknownService.probe({
      community: 'v2ex',
      ref: { community: 'v2ex', handle: 'probe-user' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const unhealthy = await unhealthyService.probe({
      community: 'v2ex',
      ref: { community: 'v2ex', handle: 'probe-user' },
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(healthy.status).toBe('HEALTHY');
    expect(degraded.status).toBe('DEGRADED');
    expect(unknown.status).toBe('UNKNOWN');
    expect(unhealthy.status).toBe('UNHEALTHY');
    expect(degraded.warnings).toEqual(['PARTIAL_RESULT']);
  });

  test(`${governanceGoldenCases.providerFallbackSafe.name}: provider probe treats disabled/rule-only as healthy and minimax failures as degraded`, async () => {
    const disabledRuleOnly = new ProviderProbeService({
      provider: 'none',
      timeoutMs: 1000,
      minimax: {
        isConfigured: false,
      },
    });
    const invalidResponse = new ProviderProbeService(
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
    const timeoutProvider = new ProviderProbeService(
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

    const disabled = await disabledRuleOnly.probe({
      provider: 'disabled',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const ruleOnly = await disabledRuleOnly.probe({
      provider: 'rule-only',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const invalid = await invalidResponse.probe({
      provider: 'minimax',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });
    const timedOut = await timeoutProvider.probe({
      provider: 'minimax',
      timeoutMs: 1000,
      governanceMode: 'BASELINE',
    });

    expect(disabled.status).toBe('HEALTHY');
    expect(ruleOnly.status).toBe('HEALTHY');
    expect(invalid.status).toBe('DEGRADED');
    expect(invalid.errorCode).toBe('NARRATIVE_INVALID_RESPONSE');
    expect(timedOut.status).toBe('DEGRADED');
    expect(timedOut.errorCode).toBe('NARRATIVE_TIMEOUT');
  });

  test('runtime self-check distinguishes HEALTHY, DEGRADED, and UNHEALTHY without exposing secrets', () => {
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
    const unhealthy = service.execute({
      source: {
        NARRATIVE_PROVIDER: 'minimax',
        MINIMAX_API_KEY: 'secret-key',
      },
    });

    expect(healthy.status).toBe('HEALTHY');
    expect(degraded.status).toBe('DEGRADED');
    expect(unhealthy.status).toBe('UNHEALTHY');
    expect(unhealthy.blockers).toEqual(['narrative-provider-config-missing']);
    expect(JSON.stringify(unhealthy)).not.toContain('secret-key');
  });

  test(`${governanceGoldenCases.connectorDegraded.name}: health aggregation stays degraded and readiness-safe when connectors or providers partially degrade`, () => {
    const aggregation = new HealthAggregationService();
    const connectorHealth = aggregation.aggregateConnectorResults([
      {
        targetType: 'connector',
        targetId: 'guozaoke',
        status: 'DEGRADED',
        checkedAt: GOVERNANCE_TEST_TIMESTAMP,
        durationMs: 100,
        success: false,
        degraded: true,
        errorCode: 'PARTIAL_RESULT',
        warnings: ['PARTIAL_RESULT'],
      },
      {
        targetType: 'connector',
        targetId: 'v2ex',
        status: 'HEALTHY',
        checkedAt: GOVERNANCE_TEST_TIMESTAMP,
        durationMs: 80,
        success: true,
        degraded: false,
        warnings: [],
      },
    ]);
    const providerHealth = aggregation.aggregateProviderResults([
      {
        targetType: 'provider',
        targetId: 'rule-only',
        status: 'HEALTHY',
        checkedAt: GOVERNANCE_TEST_TIMESTAMP,
        durationMs: 20,
        success: true,
        degraded: false,
        warnings: [],
      },
      {
        targetType: 'provider',
        targetId: 'minimax',
        status: 'DEGRADED',
        checkedAt: GOVERNANCE_TEST_TIMESTAMP,
        durationMs: 120,
        success: false,
        degraded: true,
        errorCode: 'NARRATIVE_TIMEOUT',
        warnings: ['provider-timeout'],
      },
    ]);
    const overall = aggregation.aggregateOverall({
      connectorStatus: connectorHealth.status,
      providerStatus: providerHealth.status,
      runtimeStatus: 'HEALTHY',
    });

    expect(connectorHealth.status).toBe(governanceGoldenCases.connectorDegraded.expected.connectorStatus);
    expect(providerHealth.status).toBe(governanceGoldenCases.providerFallbackSafe.expected.providerStatus);
    expect(overall).toBe('DEGRADED');
    expect(connectorHealth.targets.map((target) => target.community)).toEqual(['guozaoke', 'v2ex']);
    expect(connectorHealth.warnings).toEqual(['PARTIAL_RESULT']);
  });

  test('cron route auth remains stable for unauthorized and authorized probe requests', async () => {
    vi.resetModules();
    process.env.HEALTH_PROBE_CRON_TOKEN = 'secret';

    const { GET: unauthorizedGet } = await import('@/app/api/cron/health-probe/route');
    const unauthorized = await unauthorizedGet(
      new Request('http://localhost/api/cron/health-probe'),
    );

    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Cron health probe requires a valid bearer token.',
      },
    });

    vi.resetModules();
    process.env.HEALTH_PROBE_CRON_TOKEN = 'secret';
    vi.doMock('@/src/contexts/platform-governance/domain/services/HealthCheckService', () => ({
      HealthCheckService: class HealthCheckService {
        async checkAll() {
          return {
            status: 'HEALTHY',
            checkedAt: GOVERNANCE_TEST_TIMESTAMP,
            connectors: { status: 'HEALTHY', checkedAt: GOVERNANCE_TEST_TIMESTAMP, targets: [], warnings: [] },
            narrative: { status: 'HEALTHY', checkedAt: GOVERNANCE_TEST_TIMESTAMP, targets: [], warnings: [] },
            runtime: { status: 'HEALTHY', checkedAt: GOVERNANCE_TEST_TIMESTAMP, targets: [], warnings: [], blockers: [] },
            warnings: [],
          };
        }
      },
    }));

    const { GET } = await import('@/app/api/cron/health-probe/route');
    const authorized = await GET(
      new Request('http://localhost/api/cron/health-probe', {
        headers: {
          authorization: 'Bearer secret',
        },
      }),
    );

    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({
      status: 'HEALTHY',
      warnings: [],
    });
  });
});
