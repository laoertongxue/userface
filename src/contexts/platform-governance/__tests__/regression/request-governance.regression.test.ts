import { describe, expect, test } from 'vitest';
import { RequestGovernanceService } from '@/src/contexts/platform-governance/domain/services/RequestGovernanceService';
import { requestGovernancePolicy } from '@/src/contexts/platform-governance/domain/services/RequestGovernancePolicy';
import { InMemoryRateLimitAdapter } from '@/src/contexts/platform-governance/infrastructure/governance/InMemoryRateLimitAdapter';
import { GovernanceHttpMapper } from '@/src/contexts/platform-governance/infrastructure/governance/GovernanceHttpMapper';
import { governanceGoldenCases } from '@/src/contexts/platform-governance/__tests__/regression/goldenCases';
import {
  createBaselineAnalyzeSnapshot,
  createBaselineSuggestSnapshot,
} from '@/src/contexts/platform-governance/__tests__/regression/helpers';

describe('request governance regression', () => {
  test(`${governanceGoldenCases.baselineHealthy.name}: normal single-account analyze remains allowed`, async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: createBaselineAnalyzeSnapshot(),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(governanceGoldenCases.baselineHealthy.expected.allow);
    expect(decision.degraded).toBe(false);
    expect(decision.errorCode).toBeUndefined();
    expect(decision.abuseSignals).toEqual([]);
  });

  test('body size limit rejects oversized analyze payloads with stable mapping', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const mapper = new GovernanceHttpMapper();
    const decision = await service.enforce({
      snapshot: createBaselineAnalyzeSnapshot({
        requestBodyBytes: requestGovernancePolicy.analyzeBudget.maxRequestBodyBytes + 1,
      }),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe('GOVERNANCE_PAYLOAD_TOO_LARGE');
    expect(decision.httpStatus).toBe(413);
    expect(mapper.toHttpPayload(decision)).toEqual({
      status: 413,
      body: {
        error: {
          code: 'GOVERNANCE_PAYLOAD_TOO_LARGE',
          message: 'Request rejected because the payload exceeded the allowed governance limit.',
        },
      },
    });
  });

  test('too many accounts produces a reject decision and the expected abuse signal', async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: createBaselineAnalyzeSnapshot({
        accounts: Array.from(
          { length: requestGovernancePolicy.analyzeBudget.maxAccountsPerRequest + 1 },
          () => ({ community: 'v2ex' }),
        ),
      }),
      requestBudget: requestGovernancePolicy.analyzeBudget,
      executionPolicy: requestGovernancePolicy.executionPolicy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe('GOVERNANCE_TOO_MANY_ACCOUNTS');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TOO_MANY_ACCOUNTS',
        }),
      ]),
    );
  });

  test(`${governanceGoldenCases.suggestPairExplosion.name}: pair explosion is rejected before business execution`, async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
      snapshot: createBaselineSuggestSnapshot({
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
          code: governanceGoldenCases.suggestPairExplosion.expected.abuseSignal,
        }),
      ]),
    );
  });

  test(`${governanceGoldenCases.narrativeBudgetDisabled.name}: narrative is disabled without failing analyze`, async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const decision = await service.enforce({
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
    });

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
    expect(decision.disableNarrative).toBe(true);
    expect(decision.errorCode).toBe('GOVERNANCE_NARRATIVE_DISABLED');
    expect(decision.abuseSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: governanceGoldenCases.narrativeBudgetDisabled.expected.abuseSignal,
        }),
      ]),
    );
  });

  test(`${governanceGoldenCases.analyzeRateLimited.name}: analyze and suggest rate limits are stable and reproducible`, async () => {
    const service = new RequestGovernanceService(new InMemoryRateLimitAdapter(() => 0));
    const analyzeInput = {
      snapshot: createBaselineAnalyzeSnapshot({
        requesterFingerprint: 'fp-shared',
      }),
      requestBudget: {
        ...requestGovernancePolicy.analyzeBudget,
        maxRequests: 1,
        windowSeconds: 30,
      },
      executionPolicy: requestGovernancePolicy.executionPolicy,
    } as const;
    const suggestInput = {
      snapshot: createBaselineSuggestSnapshot({
        requesterFingerprint: 'fp-shared',
      }),
      requestBudget: {
        ...requestGovernancePolicy.suggestBudget,
        maxRequests: 1,
        windowSeconds: 30,
      },
      executionPolicy: requestGovernancePolicy.executionPolicy,
    } as const;

    const firstAnalyze = await service.enforce(analyzeInput);
    const secondAnalyze = await service.enforce(analyzeInput);
    const firstSuggest = await service.enforce(suggestInput);
    const secondSuggest = await service.enforce(suggestInput);

    expect(firstAnalyze.allowed).toBe(true);
    expect(secondAnalyze.allowed).toBe(false);
    expect(secondAnalyze.errorCode).toBe(governanceGoldenCases.analyzeRateLimited.expected.errorCode);
    expect(secondAnalyze.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(firstSuggest.allowed).toBe(true);
    expect(secondSuggest.allowed).toBe(false);
    expect(secondSuggest.errorCode).toBe('GOVERNANCE_RATE_LIMITED');
    expect(secondSuggest.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
