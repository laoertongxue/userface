import { describe, expect, test } from 'vitest';
import { EnvSwitchProvider } from '@/src/contexts/platform-governance/infrastructure/release/EnvSwitchProvider';
import { ReleaseReadinessService } from '@/src/contexts/platform-governance/domain/services/ReleaseReadinessService';
import { ReleaseGuardService } from '@/src/contexts/platform-governance/domain/services/ReleaseGuardService';
import { governanceGoldenCases } from '@/src/contexts/platform-governance/__tests__/regression/goldenCases';
import {
  FakeSwitchProvider,
  createInactiveIncident,
  createSwitchSnapshots,
} from '@/src/contexts/platform-governance/__tests__/regression/helpers';
import { createIncidentState } from '@/src/contexts/platform-governance/domain/entities/IncidentState';

describe('release safety regression', () => {
  test('EnvSwitchProvider keeps defaults and env parsing stable', () => {
    const defaults = new EnvSwitchProvider({});
    const configured = new EnvSwitchProvider({
      FEATURE_ANALYZE_ENABLED: 'false',
      FEATURE_CLUSTER_ANALYSIS_ENABLED: '0',
      FEATURE_SUGGEST_ENABLED: 'yes',
      FEATURE_MINIMAX_ENABLED: 'no',
      RELEASE_SAFETY_MODE: 'DEGRADED',
      INCIDENT_ACTIVE: 'true',
      INCIDENT_SEVERITY: 'HIGH',
      INCIDENT_REASON: 'manual-drill',
      INCIDENT_STARTED_AT: '2026-03-23T10:00:00.000Z',
    });

    expect(defaults.snapshot().every((item) => typeof item.enabled === 'boolean')).toBe(true);
    expect(defaults.isEnabled('ANALYZE_ENABLED')).toBe(true);
    expect(configured.isEnabled('ANALYZE_ENABLED')).toBe(false);
    expect(configured.isEnabled('CLUSTER_ANALYSIS_ENABLED')).toBe(false);
    expect(configured.isEnabled('MINIMAX_ENABLED')).toBe(false);
    expect(configured.getSafetyMode()).toBe('DEGRADED');
    expect(configured.getIncidentState()).toMatchObject({
      active: true,
      severity: 'HIGH',
      mode: 'INCIDENT',
      reason: 'manual-drill',
    });
  });

  test(`${governanceGoldenCases.releaseNotReady.name}: runtime blocker and incident state both make readiness false`, () => {
    const service = new ReleaseReadinessService();
    const snapshot = service.evaluate({
      mode: 'INCIDENT',
      switches: createSwitchSnapshots({ ANALYZE_ENABLED: false }),
      incident: createIncidentState({
        active: true,
        severity: 'CRITICAL',
        mode: 'INCIDENT',
        reason: 'outage',
        activeSwitches: ['ANALYZE_ENABLED', 'SUGGEST_ENABLED'],
      }),
      runtimeStatus: 'UNHEALTHY',
      connectorStatus: 'UNHEALTHY',
      providerStatus: 'DEGRADED',
    });

    expect(snapshot.ready).toBe(false);
    expect(snapshot.blockers).toEqual(
      expect.arrayContaining(['incident-active', 'runtime-unhealthy', 'connectors-unhealthy', 'analyze-disabled']),
    );
    expect(snapshot.activeSwitches).toEqual(
      expect.arrayContaining(['ANALYZE_ENABLED', 'SUGGEST_ENABLED']),
    );
  });

  test('connector degraded and provider fallback-safe conditions stay as warnings rather than blockers', () => {
    const service = new ReleaseReadinessService();
    const snapshot = service.evaluate({
      mode: 'NORMAL',
      switches: createSwitchSnapshots(),
      incident: createInactiveIncident(),
      runtimeStatus: 'HEALTHY',
      connectorStatus: 'DEGRADED',
      providerStatus: 'DEGRADED',
    });

    expect(snapshot.ready).toBe(true);
    expect(snapshot.blockers).toEqual([]);
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        governanceGoldenCases.connectorDegraded.expected.releaseWarning,
        governanceGoldenCases.providerFallbackSafe.expected.releaseWarning,
      ]),
    );
  });

  test('analyze disabled switch rejects analyze requests', () => {
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ ANALYZE_ENABLED: false })),
    );
    const decision = service.evaluate({
      route: '/api/analyze',
      hasCluster: false,
      requestedNarrativeProvider: 'none',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toEqual(['RELEASE_ANALYZE_DISABLED']);
  });

  test('cluster disabled only blocks cluster analyze and not single analyze', () => {
    const service = new ReleaseGuardService(
      new FakeSwitchProvider(createSwitchSnapshots({ CLUSTER_ANALYSIS_ENABLED: false })),
    );

    expect(
      service.evaluate({
        route: '/api/analyze',
        hasCluster: true,
        requestedNarrativeProvider: 'none',
      }),
    ).toMatchObject({
      allowed: false,
      reasonCodes: ['RELEASE_CLUSTER_DISABLED'],
    });

    expect(
      service.evaluate({
        route: '/api/analyze',
        hasCluster: false,
        requestedNarrativeProvider: 'none',
      }),
    ).toMatchObject({
      allowed: true,
    });
  });

  test('suggest disabled rejects suggest requests with a stable reason code', () => {
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

  test('narrative falls back to RuleOnly when MiniMax is disabled but narrative stays enabled', () => {
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

  test(`${governanceGoldenCases.incidentModeClusterOff.name}: incident mode disables cluster and suggest while preserving safe single analyze`, () => {
    const incident = createIncidentState({
      active: true,
      severity: 'HIGH',
      mode: 'INCIDENT',
      reason: 'manual-drill',
      activeSwitches: ['CLUSTER_ANALYSIS_ENABLED', 'SUGGEST_ENABLED', 'NARRATIVE_ENABLED'],
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
    expect(suggestDecision.allowed).toBe(false);
    expect(suggestDecision.reasonCodes).toEqual(['RELEASE_INCIDENT_SUGGEST_DISABLED']);
  });
});
