import { describe, expect, test } from 'vitest';
import {
  createFeatureSwitchSnapshot,
  type FeatureSwitchSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/FeatureSwitchSnapshot';
import {
  createIncidentState,
  type IncidentState,
} from '@/src/contexts/platform-governance/domain/entities/IncidentState';
import type { FeatureSwitchProvider } from '@/src/contexts/platform-governance/domain/services/FeatureSwitchProvider';
import { ReleaseGuardService } from '@/src/contexts/platform-governance/domain/services/ReleaseGuardService';
import { ReleaseReadinessService } from '@/src/contexts/platform-governance/domain/services/ReleaseReadinessService';
import { EnvSwitchProvider } from '@/src/contexts/platform-governance/infrastructure/release/EnvSwitchProvider';
import { featureSwitchKeyValues, type FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';
import {
  createTestObservabilityContext,
  MemoryObservabilitySink,
} from '@/src/contexts/platform-governance/__tests__/observabilityTestHelpers';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

function createSwitchSnapshots(
  overrides: Partial<Record<FeatureSwitchKey, boolean>> = {},
): FeatureSwitchSnapshot[] {
  return [...featureSwitchKeyValues]
    .map((key) =>
      createFeatureSwitchSnapshot({
        key,
        enabled: overrides[key] ?? true,
        source: 'provider',
      }),
    )
    .sort((left, right) => left.key.localeCompare(right.key));
}

class FakeSwitchProvider implements FeatureSwitchProvider {
  constructor(
    private readonly snapshots: FeatureSwitchSnapshot[],
    private readonly mode: ReleaseSafetyMode = 'NORMAL',
    private readonly incident: IncidentState = createIncidentState({
      active: false,
      severity: 'INFO',
      mode: 'NORMAL',
      reason: 'none',
      activeSwitches: [],
    }),
  ) {}

  isEnabled(key: FeatureSwitchKey): boolean {
    return this.snapshots.find((item) => item.key === key)?.enabled ?? false;
  }

  snapshot(): FeatureSwitchSnapshot[] {
    return [...this.snapshots];
  }

  getSafetyMode(): ReleaseSafetyMode {
    return this.mode;
  }

  getIncidentState(): IncidentState {
    return this.incident;
  }
}

describe('release safety', () => {
  test('EnvSwitchProvider exposes stable defaults and env overrides', () => {
    const defaults = new EnvSwitchProvider({});
    const configured = new EnvSwitchProvider({
      FEATURE_ANALYZE_ENABLED: 'false',
      FEATURE_MINIMAX_ENABLED: '0',
      RELEASE_SAFETY_MODE: 'DEGRADED',
      INCIDENT_ACTIVE: 'true',
      INCIDENT_SEVERITY: 'HIGH',
      INCIDENT_REASON: 'manual-drill',
    });

    expect(defaults.isEnabled('ANALYZE_ENABLED')).toBe(true);
    expect(defaults.getSafetyMode()).toBe('NORMAL');
    expect(configured.isEnabled('ANALYZE_ENABLED')).toBe(false);
    expect(configured.isEnabled('MINIMAX_ENABLED')).toBe(false);
    expect(configured.getSafetyMode()).toBe('DEGRADED');
    expect(configured.getIncidentState()).toMatchObject({
      active: true,
      severity: 'HIGH',
      mode: 'INCIDENT',
      reason: 'manual-drill',
    });
    expect(configured.snapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'ANALYZE_ENABLED',
          enabled: false,
        }),
      ]),
    );
  });

  test('ReleaseReadinessService returns blockers for runtime failure and incident active state', () => {
    const service = new ReleaseReadinessService();
    const snapshot = service.evaluate({
      mode: 'INCIDENT',
      switches: createSwitchSnapshots(),
      incident: createIncidentState({
        active: true,
        severity: 'HIGH',
        mode: 'INCIDENT',
        reason: 'manual-drill',
        activeSwitches: ['SUGGEST_ENABLED', 'CLUSTER_ANALYSIS_ENABLED'],
      }),
      runtimeStatus: 'UNHEALTHY',
      connectorStatus: 'HEALTHY',
      providerStatus: 'DEGRADED',
    });

    expect(snapshot.ready).toBe(false);
    expect(snapshot.blockers).toEqual(
      expect.arrayContaining(['incident-active', 'runtime-unhealthy']),
    );
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining(['narrative-provider-degraded']),
    );
    expect(snapshot.activeSwitches).toEqual(
      expect.arrayContaining(['CLUSTER_ANALYSIS_ENABLED', 'SUGGEST_ENABLED']),
    );
  });

  test('ReleaseReadinessService treats degraded connectors as warnings and provider degradation as non-blocking when analyze remains available', () => {
    const service = new ReleaseReadinessService();
    const snapshot = service.evaluate({
      mode: 'NORMAL',
      switches: createSwitchSnapshots({
        SUGGEST_ENABLED: false,
      }),
      incident: createIncidentState({
        active: false,
        severity: 'INFO',
        mode: 'NORMAL',
        reason: 'none',
        activeSwitches: [],
      }),
      runtimeStatus: 'HEALTHY',
      connectorStatus: 'DEGRADED',
      providerStatus: 'DEGRADED',
    });

    expect(snapshot.ready).toBe(true);
    expect(snapshot.blockers).toEqual([]);
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        'connectors-degraded',
        'narrative-provider-degraded',
        'suggest-disabled',
      ]),
    );
  });

  test('ReleaseGuardService rejects analyze requests when analyze is disabled', () => {
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ ANALYZE_ENABLED: false })),
    );
    const decision = service.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'none',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.httpStatus).toBe(503);
    expect(decision.reasonCodes).toEqual(['RELEASE_ANALYZE_DISABLED']);
  });

  test('ReleaseGuardService rejects cluster analysis when cluster switch is disabled but allows single-account analyze', () => {
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ CLUSTER_ANALYSIS_ENABLED: false })),
    );

    const rejected = service.evaluate({
      route: '/api/analyze',
      hasCluster: true,
      requestedNarrativeProvider: 'none',
    });
    const allowed = service.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'none',
    });

    expect(rejected.allowed).toBe(false);
    expect(rejected.reasonCodes).toEqual(['RELEASE_CLUSTER_DISABLED']);
    expect(allowed.allowed).toBe(true);
  });

  test('ReleaseGuardService rejects suggest requests when suggest is disabled', () => {
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ SUGGEST_ENABLED: false })),
    );
    const decision = service.evaluate({
      route: '/api/identity/suggest',
      hasCluster: false,
      requestedNarrativeProvider: 'none',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toEqual(['RELEASE_SUGGEST_DISABLED']);
  });

  test('ReleaseGuardService forces RuleOnly narrative when MiniMax is disabled', () => {
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ MINIMAX_ENABLED: false })),
    );
    const decision = service.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'minimax',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.degradationPlan.forceRuleOnlyNarrative).toBe(true);
    expect(decision.degradationPlan.disableNarrative).toBe(false);
    expect(decision.reasonCodes).toEqual(['RELEASE_MINIMAX_DISABLED']);
  });

  test('ReleaseGuardService applies incident mode policy consistently', () => {
    const incident = createIncidentState({
      active: true,
      severity: 'HIGH',
      mode: 'INCIDENT',
      reason: 'connector-outage',
      activeSwitches: ['SUGGEST_ENABLED', 'CLUSTER_ANALYSIS_ENABLED', 'NARRATIVE_ENABLED'],
    });
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots(), 'INCIDENT', incident),
    );

    const clusterDecision = service.evaluate({
      route: '/api/analyze',
      hasCluster: true,
      requestedNarrativeProvider: 'minimax',
    });
    const singleDecision = service.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'minimax',
    });
    const suggestDecision = service.evaluate({
      route: '/api/identity/suggest',
      hasCluster: false,
      requestedNarrativeProvider: 'none',
    });

    expect(clusterDecision.allowed).toBe(false);
    expect(clusterDecision.reasonCodes).toEqual(['RELEASE_INCIDENT_CLUSTER_DISABLED']);
    expect(singleDecision.allowed).toBe(true);
    expect(singleDecision.degradationPlan.disableNarrative).toBe(true);
    expect(singleDecision.reasonCodes).toEqual(['RELEASE_INCIDENT_NARRATIVE_DISABLED']);
    expect(suggestDecision.allowed).toBe(false);
    expect(suggestDecision.reasonCodes).toEqual(['RELEASE_INCIDENT_SUGGEST_DISABLED']);
  });

  test('ReleaseGuardService emits observability events for rejected, degraded, and forced RuleOnly paths', () => {
    const sink = new MemoryObservabilitySink();
    const context = createTestObservabilityContext(sink, {
      route: '/api/analyze',
      operation: 'analyze.request',
    });
    const rejectedService = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ ANALYZE_ENABLED: false })),
    );
    const degradedService = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ MINIMAX_ENABLED: false })),
    );

    rejectedService.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'none',
      observability: context,
    });
    degradedService.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'minimax',
      observability: context,
    });

    expect(sink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: observabilityEvents.releaseGuardRejected }),
        expect.objectContaining({ event: observabilityEvents.releaseGuardDegraded }),
        expect.objectContaining({ event: observabilityEvents.releaseNarrativeForcedRuleOnly }),
      ]),
    );
    expect(sink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: metricNames.releaseGuardRejectedTotal }),
        expect.objectContaining({ name: metricNames.releaseGuardDegradedTotal }),
        expect.objectContaining({ name: metricNames.releaseNarrativeForcedRuleOnlyTotal }),
      ]),
    );
  });

  test('ReleaseReadinessService emits readiness observability when system is not ready', () => {
    const sink = new MemoryObservabilitySink();
    const context = createTestObservabilityContext(sink, {
      route: '/api/health/release-readiness',
      operation: 'health.release-readiness',
    });
    const service = new ReleaseReadinessService();

    const snapshot = service.evaluate({
      mode: 'INCIDENT',
      switches: createSwitchSnapshots({ ANALYZE_ENABLED: false }),
      incident: createIncidentState({
        active: true,
        severity: 'CRITICAL',
        mode: 'INCIDENT',
        reason: 'manual-drill',
        activeSwitches: ['ANALYZE_ENABLED'],
      }),
      runtimeStatus: 'UNHEALTHY',
      connectorStatus: 'UNHEALTHY',
      providerStatus: 'DEGRADED',
      observability: context,
    });

    expect(snapshot.ready).toBe(false);
    expect(sink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: observabilityEvents.releaseReadinessEvaluated }),
        expect.objectContaining({ event: observabilityEvents.incidentModeActive }),
      ]),
    );
    expect(sink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: metricNames.releaseReadinessNotReadyTotal }),
      ]),
    );
  });
});
