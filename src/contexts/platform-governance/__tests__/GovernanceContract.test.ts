import { describe, expect, test } from 'vitest';
import {
  abuseSignalCodeValues,
  abuseSignalSourceValues,
  createAbuseSignal,
} from '@/src/contexts/platform-governance/domain/entities/AbuseSignal';
import {
  createConnectorHealthSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/ConnectorHealthSnapshot';
import {
  createProviderHealthSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/ProviderHealthSnapshot';
import {
  createReleaseReadiness,
} from '@/src/contexts/platform-governance/domain/entities/ReleaseReadiness';
import {
  createRequestBudget,
  requestBudgetScopeValues,
} from '@/src/contexts/platform-governance/domain/entities/RequestBudget';
import {
  createRuntimeExecutionPolicy,
} from '@/src/contexts/platform-governance/domain/entities/RuntimeExecutionPolicy';
import {
  createGovernanceSnapshot,
} from '@/src/contexts/platform-governance/application/dto/GovernanceSnapshot';
import {
  governanceModeValues,
} from '@/src/contexts/platform-governance/domain/value-objects/GovernanceMode';
import {
  healthStatusValues,
} from '@/src/contexts/platform-governance/domain/value-objects/HealthStatus';
import {
  incidentSeverityValues,
} from '@/src/contexts/platform-governance/domain/value-objects/IncidentSeverity';

describe('platform governance contracts', () => {
  test('exposes stable runtime governance literals', () => {
    expect(governanceModeValues).toEqual(['OFF', 'BASELINE', 'STRICT']);
    expect(healthStatusValues).toEqual(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']);
    expect(incidentSeverityValues).toEqual(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  });

  test('constructs a RequestBudget with cluster-aware limits', () => {
    const budget = createRequestBudget({
      scope: 'ANALYZE',
      maxRequests: 30,
      windowSeconds: 60,
      maxRequestBodyBytes: 8_192,
      maxAccountsPerRequest: 6,
      maxCommunitiesPerRequest: 3,
      maxSuggestionPairsPerRequest: 15,
      maxNarrativeCallsPerRequest: 1,
      maxClusterComplexityScore: 18,
      maxNarrativeComplexityScore: 12,
      enabled: true,
    });

    expect(requestBudgetScopeValues).toContain('ANALYZE');
    expect(budget).toMatchObject({
      scope: 'ANALYZE',
      maxAccountsPerRequest: 6,
      maxSuggestionPairsPerRequest: 15,
      maxNarrativeCallsPerRequest: 1,
      enabled: true,
    });
  });

  test('constructs a RuntimeExecutionPolicy with fallback and cluster toggles', () => {
    const policy = createRuntimeExecutionPolicy({
      maxDurationMs: 25_000,
      maxConnectorConcurrency: 2,
      maxProviderConcurrency: 1,
      allowNarrative: true,
      allowSuggestion: true,
      allowClusterAnalysis: true,
      fallbackOnProviderFailure: true,
      failFastOnAllConnectorFailure: true,
    });

    expect(policy).toMatchObject({
      allowNarrative: true,
      allowSuggestion: true,
      allowClusterAnalysis: true,
      fallbackOnProviderFailure: true,
      failFastOnAllConnectorFailure: true,
    });
  });

  test('constructs an AbuseSignal with stable code, severity, and source', () => {
    const signal = createAbuseSignal({
      code: 'TOO_MANY_SUGGESTION_PAIRS',
      severity: 'MEDIUM',
      message: 'Suggestion pair count exceeded the governance baseline.',
      source: 'IDENTITY_SUGGESTION',
      observedValue: 21,
      threshold: 15,
      context: {
        route: '/api/identity/suggest',
      },
    });

    expect(abuseSignalCodeValues).toContain('TOO_MANY_SUGGESTION_PAIRS');
    expect(abuseSignalSourceValues).toContain('IDENTITY_SUGGESTION');
    expect(signal).toMatchObject({
      code: 'TOO_MANY_SUGGESTION_PAIRS',
      severity: 'MEDIUM',
      source: 'IDENTITY_SUGGESTION',
      observedValue: 21,
      threshold: 15,
    });
  });

  test('constructs connector and provider health snapshots with shared HealthStatus', () => {
    const connectorHealth = createConnectorHealthSnapshot({
      community: 'v2ex',
      status: 'DEGRADED',
      lastCheckedAt: '2026-03-23T10:00:00.000Z',
      latencyMs: 840,
      successRate: 0.82,
      warnings: ['selector drift observed', 'selector drift observed'],
      degraded: true,
    });

    const providerHealth = createProviderHealthSnapshot({
      provider: 'minimax',
      status: 'HEALTHY',
      lastCheckedAt: '2026-03-23T10:00:00.000Z',
      latencyMs: 1_250,
      timeoutRate: 0.02,
      invalidResponseRate: 0.01,
      warnings: ['temporary fallback observed'],
    });

    expect(connectorHealth).toMatchObject({
      community: 'v2ex',
      status: 'DEGRADED',
      degraded: true,
      warnings: ['selector drift observed'],
    });
    expect(providerHealth).toMatchObject({
      provider: 'minimax',
      status: 'HEALTHY',
      timeoutRate: 0.02,
      invalidResponseRate: 0.01,
    });
  });

  test('constructs a GovernanceSnapshot that can aggregate budget, abuse, health, and readiness', () => {
    const snapshot = createGovernanceSnapshot({
      mode: 'BASELINE',
      executionPolicy: createRuntimeExecutionPolicy({
        maxDurationMs: 25_000,
        maxConnectorConcurrency: 2,
        maxProviderConcurrency: 1,
        allowNarrative: true,
        allowSuggestion: true,
        allowClusterAnalysis: true,
        fallbackOnProviderFailure: true,
        failFastOnAllConnectorFailure: true,
      }),
      requestBudget: createRequestBudget({
        scope: 'ANALYZE',
      maxRequests: 30,
      windowSeconds: 60,
      maxRequestBodyBytes: 8_192,
      maxAccountsPerRequest: 6,
      maxCommunitiesPerRequest: 3,
      maxSuggestionPairsPerRequest: 15,
      maxNarrativeCallsPerRequest: 1,
      maxClusterComplexityScore: 18,
      maxNarrativeComplexityScore: 12,
      enabled: true,
    }),
      abuseSignals: [
        createAbuseSignal({
          code: 'OVERSIZED_INPUT',
          severity: 'LOW',
          message: 'Request payload is larger than the recommended baseline.',
          source: 'REQUEST_GOVERNANCE',
        }),
      ],
      connectorHealth: [
        createConnectorHealthSnapshot({
          community: 'guozaoke',
          status: 'HEALTHY',
          warnings: [],
          degraded: false,
        }),
      ],
      providerHealth: [
        createProviderHealthSnapshot({
          provider: 'rule-only',
          status: 'HEALTHY',
          warnings: [],
        }),
      ],
      releaseReadiness: createReleaseReadiness({
        ready: true,
        blockers: [],
        warnings: ['narrative fallback rate should still be monitored in the next stage'],
        checkedAt: '2026-03-23T10:10:00.000Z',
        scope: 'stage-6-baseline',
      }),
    });

    expect(snapshot.mode).toBe('BASELINE');
    expect(snapshot.executionPolicy?.allowNarrative).toBe(true);
    expect(snapshot.requestBudget?.maxAccountsPerRequest).toBe(6);
    expect(snapshot.abuseSignals).toHaveLength(1);
    expect(snapshot.connectorHealth).toHaveLength(1);
    expect(snapshot.providerHealth).toHaveLength(1);
    expect(snapshot.releaseReadiness).toMatchObject({
      ready: true,
      scope: 'stage-6-baseline',
    });
  });
});
