import { describe, expect, test } from 'vitest';
import { RequestGovernanceService } from '@/src/contexts/platform-governance/domain/services/RequestGovernanceService';
import { RuntimeSelfCheckService } from '@/src/contexts/platform-governance/domain/services/RuntimeSelfCheckService';
import { ReleaseGuardService } from '@/src/contexts/platform-governance/domain/services/ReleaseGuardService';
import { requestGovernancePolicy } from '@/src/contexts/platform-governance/domain/services/RequestGovernancePolicy';
import { InMemoryRateLimitAdapter } from '@/src/contexts/platform-governance/infrastructure/governance/InMemoryRateLimitAdapter';
import { StructuredLogger, observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import { createTraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { MemoryObservabilitySink, createTestObservabilityContext } from '@/src/contexts/platform-governance/__tests__/observabilityTestHelpers';
import { FakeSwitchProvider, createBaselineAnalyzeSnapshot, createSwitchSnapshots } from '@/src/contexts/platform-governance/__tests__/regression/helpers';

describe('governance observability regression', () => {
  test('trace propagation stays stable across analyze and health-style child contexts', () => {
    const request = new Request('http://localhost/api/analyze', {
      headers: {
        'x-trace-id': 'trace-governance-regression',
        'x-request-id': 'request-governance-regression',
      },
    });

    const root = createTraceContext({
      headers: request.headers,
      route: '/api/analyze',
      operation: 'analyze.request',
    });
    const analyzeChild = createTraceContext({
      traceId: root.traceId,
      requestId: root.requestId,
      route: root.route,
      operation: 'cluster.analysis',
      startedAt: root.startedAt,
      parentTraceId: root.parentTraceId,
    });
    const healthChild = createTraceContext({
      traceId: root.traceId,
      requestId: root.requestId,
      route: '/api/health/runtime',
      operation: 'health.runtime',
      startedAt: root.startedAt,
      parentTraceId: root.traceId,
    });

    expect(root.traceId).toBe('trace-governance-regression');
    expect(analyzeChild.traceId).toBe(root.traceId);
    expect(healthChild.traceId).toBe(root.traceId);
    expect(healthChild.requestId).toBe(root.requestId);
  });

  test('structured logs remain stable and sensitive fields stay redacted', () => {
    const sink = new MemoryObservabilitySink();
    const trace = createTraceContext({
      route: '/api/analyze',
      operation: 'analyze.request',
      traceId: 'trace-redaction',
      requestId: 'request-redaction',
      startedAt: '2026-03-23T10:00:00.000Z',
    });
    const logger = new StructuredLogger(trace, sink);

    logger.event(observabilityEvents.narrativeGenerateFailed, {
      level: 'error',
      message: 'Narrative failed during regression test.',
      context: {
        prompt: 'raw prompt should never be logged',
        token: 'super-secret-token',
        cookie: 'session=abc',
        handle: 'alpha-user',
        excerpt: 'raw evidence should never be logged',
        longText: 'x'.repeat(160),
        nested: {
          bodyText: 'full post body',
        },
      },
      errorCode: 'NARRATIVE_INVALID_RESPONSE',
    });

    const entry = sink.logs[0];
    const serialized = JSON.stringify(entry);

    expect(entry).toMatchObject({
      level: 'error',
      traceId: 'trace-redaction',
      event: observabilityEvents.narrativeGenerateFailed,
      message: 'Narrative failed during regression test.',
      errorCode: 'NARRATIVE_INVALID_RESPONSE',
    });
    expect(entry.ts).toBeTruthy();
    expect(entry.context).toMatchObject({
      prompt: '[REDACTED]',
      token: '[REDACTED]',
      cookie: '[REDACTED]',
      handle: expect.stringMatching(/^hash:/),
      excerpt: '[REDACTED]',
      longText: '[REDACTED_TEXT:length=160]',
      nested: {
        bodyText: '[REDACTED]',
      },
    });
    expect(serialized).not.toContain('raw prompt should never be logged');
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('alpha-user');
  });

  test('governance, health, and release metrics use stable names and low-cardinality tags', async () => {
    const sink = new MemoryObservabilitySink();
    const observability = createTestObservabilityContext(sink, {
      route: '/api/analyze',
      operation: 'analyze.request',
    });
    const governanceService = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const releaseGuardService = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ MINIMAX_ENABLED: false })),
    );
    const runtimeSelfCheckService = new RuntimeSelfCheckService();

    await governanceService.enforce({
      snapshot: createBaselineAnalyzeSnapshot({
        llmProvider: 'minimax',
        accounts: [
          { community: 'v2ex' },
          { community: 'v2ex' },
          { community: 'guozaoke' },
          { community: 'guozaoke' },
        ],
      }),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
      observability,
    });

    releaseGuardService.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'minimax',
      observability,
    });

    runtimeSelfCheckService.execute({
      source: {
        NARRATIVE_PROVIDER: 'none',
        HEALTH_PROBE_CRON_TOKEN: 'secret',
      },
      observability,
    });

    const metricNamesSeen = sink.metrics.map((entry) => entry.name);

    expect(metricNamesSeen).toEqual(
      expect.arrayContaining([
        metricNames.governanceRequestTotal,
        metricNames.governanceRequestDegradedTotal,
        metricNames.governanceNarrativeDisabledTotal,
        metricNames.releaseGuardTotal,
        metricNames.releaseGuardDegradedTotal,
        metricNames.releaseNarrativeForcedRuleOnlyTotal,
        metricNames.healthRuntimeCheckTotal,
      ]),
    );
    expect(
      sink.metrics.every((entry) => !('handle' in entry.tags) && !('prompt' in entry.tags) && !('url' in entry.tags)),
    ).toBe(true);
  });
});
