import { describe, expect, test } from 'vitest';
import { RequestGovernanceService } from '@/src/contexts/platform-governance/domain/services/RequestGovernanceService';
import { requestGovernancePolicy } from '@/src/contexts/platform-governance/domain/services/RequestGovernancePolicy';
import {
  createAnalyzeRequestComplexitySnapshot,
  createSuggestRequestComplexitySnapshot,
} from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import { InMemoryRateLimitAdapter } from '@/src/contexts/platform-governance/infrastructure/governance/InMemoryRateLimitAdapter';
import {
  createTestObservabilityContext,
  MemoryObservabilitySink,
} from '@/src/contexts/platform-governance/__tests__/observabilityTestHelpers';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

function analyzeSnapshot(overrides: Partial<Parameters<typeof createAnalyzeRequestComplexitySnapshot>[0]> = {}) {
  return createAnalyzeRequestComplexitySnapshot({
    requestBodyBytes: 256,
    requestedAt: '2026-03-23T10:00:00.000Z',
    requesterFingerprint: 'fp-analyze',
    governanceMode: requestGovernancePolicy.mode,
    accounts: [{ community: 'v2ex' }],
    llmProvider: 'none',
    ...overrides,
  });
}

function suggestSnapshot(overrides: Partial<Parameters<typeof createSuggestRequestComplexitySnapshot>[0]> = {}) {
  return createSuggestRequestComplexitySnapshot({
    requestBodyBytes: 256,
    requestedAt: '2026-03-23T10:00:00.000Z',
    requesterFingerprint: 'fp-suggest',
    governanceMode: requestGovernancePolicy.mode,
    accounts: [
      { community: 'v2ex' },
      { community: 'guozaoke' },
    ],
    ...overrides,
  });
}

describe('RequestGovernanceService', () => {
  test('rejects analyze requests whose body exceeds the configured budget', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: analyzeSnapshot({
        requestBodyBytes: requestGovernancePolicy.analyzeBudget.maxRequestBodyBytes + 1,
      }),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.httpStatus).toBe(413);
    expect(decision.errorCode).toBe('GOVERNANCE_PAYLOAD_TOO_LARGE');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'OVERSIZED_INPUT',
        }),
      ]),
    );
  });

  test('rejects analyze requests with too many accounts', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: analyzeSnapshot({
        accounts: Array.from({ length: requestGovernancePolicy.analyzeBudget.maxAccountsPerRequest + 1 }, () => ({
          community: 'v2ex',
        })),
      }),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.httpStatus).toBe(400);
    expect(decision.errorCode).toBe('GOVERNANCE_TOO_MANY_ACCOUNTS');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TOO_MANY_ACCOUNTS',
        }),
      ]),
    );
  });

  test('rejects suggest requests with too many estimated pairs', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: suggestSnapshot({
        accounts: Array.from({ length: 7 }, (_, index) => ({
          community: index % 2 === 0 ? 'v2ex' : 'guozaoke',
        })),
      }),
      requestBudget: requestGovernancePolicy.suggestBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe('GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TOO_MANY_SUGGESTION_PAIRS',
        }),
      ]),
    );
  });

  test('rejects complex cluster requests before business execution', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: analyzeSnapshot({
        accounts: [
          { community: 'v2ex' },
          { community: 'v2ex' },
          { community: 'guozaoke' },
          { community: 'guozaoke' },
          { community: 'weibo' },
          { community: 'weibo' },
        ],
      }),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe('GOVERNANCE_CLUSTER_COMPLEXITY_EXCEEDED');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EXCESSIVE_CLUSTER_COMPLEXITY',
        }),
      ]),
    );
  });

  test('degrades analyze requests by disabling narrative when narrative budget is exceeded', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: analyzeSnapshot({
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
    });

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
    expect(decision.disableNarrative).toBe(true);
    expect(decision.errorCode).toBe('GOVERNANCE_NARRATIVE_DISABLED');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_BUDGET_EXCEEDED',
        }),
      ]),
    );
  });

  test('rate limit adapter denies repeated requests with retryAfterSeconds', async () => {
    const adapter = new InMemoryRateLimitAdapter(() => 0);
    const service = new RequestGovernanceService(adapter);
    const input = {
      snapshot: analyzeSnapshot(),
      requestBudget: {
        ...requestGovernancePolicy.analyzeBudget,
        maxRequests: 1,
        windowSeconds: 30,
      },
      executionPolicy: requestGovernancePolicy.executionPolicy,
    } as const;

    const first = await service.enforce(input);
    const second = await service.enforce(input);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.httpStatus).toBe(429);
    expect(second.errorCode).toBe('GOVERNANCE_RATE_LIMITED');
    expect(second.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(second.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TOO_FREQUENT_ANALYZE',
        }),
      ]),
    );
  });

  test('does not reject a normal single-account analyze request', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: analyzeSnapshot(),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(false);
    expect(decision.disableNarrative).toBe(false);
    expect(decision.abuseSignals).toHaveLength(0);
  });

  test('emits governance logs and metrics for rejected and degraded requests', async () => {
    const rejectSink = new MemoryObservabilitySink();
    const degradedSink = new MemoryObservabilitySink();
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));

    await service.enforce({
      snapshot: suggestSnapshot({
        accounts: Array.from({ length: 7 }, (_, index) => ({
          community: index % 2 === 0 ? 'v2ex' : 'guozaoke',
        })),
      }),
      requestBudget: requestGovernancePolicy.suggestBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
      observability: createTestObservabilityContext(rejectSink, {
        route: '/api/identity/suggest',
        operation: 'suggest.request',
      }),
    });

    await service.enforce({
      snapshot: analyzeSnapshot({
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
      observability: createTestObservabilityContext(degradedSink, {
        route: '/api/analyze',
        operation: 'analyze.request',
      }),
    });

    expect(rejectSink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: observabilityEvents.governanceRequestRejected,
        }),
      ]),
    );
    expect(rejectSink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: metricNames.governanceRequestRejectedTotal,
        }),
      ]),
    );
    expect(degradedSink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: observabilityEvents.governanceRequestDegraded,
        }),
        expect.objectContaining({
          event: observabilityEvents.governanceNarrativeDisabled,
        }),
      ]),
    );
    expect(degradedSink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: metricNames.governanceRequestDegradedTotal,
        }),
        expect.objectContaining({
          name: metricNames.governanceNarrativeDisabledTotal,
        }),
      ]),
    );
  });
});
