import {
  createDegradationPlan,
  type DegradationPlan,
} from '@/src/contexts/platform-governance/domain/entities/DegradationPlan';
import type { IncidentState } from '@/src/contexts/platform-governance/domain/entities/IncidentState';
import type { FeatureSwitchProvider } from '@/src/contexts/platform-governance/domain/services/FeatureSwitchProvider';
import { EnvSwitchProvider } from '@/src/contexts/platform-governance/infrastructure/release/EnvSwitchProvider';
import type {
  ReleaseGuardDecision,
  ReleaseReasonCode,
} from '@/src/contexts/platform-governance/application/dto/ReleaseGuardDecision';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import type { NormalizedErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';

type ReleaseGuardInput = {
  route: '/api/analyze' | '/api/identity/suggest';
  hasCluster: boolean;
  requestedNarrativeProvider?: 'minimax' | 'none';
  observability?: ObservabilityContext;
};

function asDecision(input: {
  allowed: boolean;
  mode: ReleaseSafetyMode;
  degradationPlan?: Partial<DegradationPlan>;
  reasonCodes?: ReleaseReasonCode[];
  httpStatus?: number;
  warnings?: string[];
}): ReleaseGuardDecision {
  const degradationPlan = createDegradationPlan({
    ...input.degradationPlan,
    reasonCodes: [
      ...(input.degradationPlan?.reasonCodes ?? []),
      ...(input.reasonCodes ?? []),
    ],
  });

  return {
    allowed: input.allowed,
    mode: input.mode,
    degradationPlan,
    reasonCodes: [...new Set(input.reasonCodes ?? [])],
    httpStatus: input.httpStatus,
    warnings: [...new Set(input.warnings ?? [])],
  };
}

export class ReleaseGuardService {
  constructor(private readonly switchProvider: FeatureSwitchProvider = new EnvSwitchProvider()) {}

  private emitMetricsAndLogs(
    input: ReleaseGuardInput,
    decision: ReleaseGuardDecision,
    incident: IncidentState,
  ): void {
    const observability = input.observability?.child('release.guard');
    const primaryReasonCode = decision.reasonCodes[0] ?? 'none';
    const normalizedReasonCode =
      decision.reasonCodes.length === 0
        ? undefined
        : (primaryReasonCode as NormalizedErrorCode);

    observability?.logger.event(observabilityEvents.releaseGuardEvaluated, {
      message: 'Release guard evaluated request.',
      context: {
        route: input.route,
        mode: decision.mode,
        allowed: decision.allowed,
        degraded: decision.degradationPlan.disableNarrative || decision.degradationPlan.forceRuleOnlyNarrative,
        reasonCode: primaryReasonCode,
        governanceMode: platformPolicies.requestGovernance.mode,
        incidentSeverity: incident.severity,
      },
    });
    observability?.metrics.counter(metricNames.releaseGuardTotal, 1, {
      route: input.route,
      mode: decision.mode,
      reasonCode: primaryReasonCode,
      governanceMode: platformPolicies.requestGovernance.mode,
      incidentSeverity: incident.severity,
    });

    if (incident.active) {
      observability?.logger.event(observabilityEvents.incidentModeActive, {
        level: 'warn',
        message: 'Incident mode affected the current request.',
        context: {
          route: input.route,
          mode: decision.mode,
          incidentSeverity: incident.severity,
        },
      });
    }

    if (!decision.allowed) {
      observability?.logger.event(observabilityEvents.releaseGuardRejected, {
        level: 'warn',
        message: 'Release guard rejected request.',
        errorCode: normalizedReasonCode,
        context: {
          route: input.route,
          mode: decision.mode,
          governanceMode: platformPolicies.requestGovernance.mode,
          incidentSeverity: incident.severity,
        },
      });
      observability?.metrics.counter(metricNames.releaseGuardRejectedTotal, 1, {
        route: input.route,
        mode: decision.mode,
        reasonCode: primaryReasonCode,
        governanceMode: platformPolicies.requestGovernance.mode,
        incidentSeverity: incident.severity,
      });
    }

    if (
      decision.degradationPlan.disableAnalyze ||
      decision.degradationPlan.disableClusterAnalysis ||
      decision.degradationPlan.disableSuggest ||
      decision.degradationPlan.disableNarrative
    ) {
      observability?.logger.event(observabilityEvents.releaseSwitchDisabled, {
        level: 'warn',
        message: 'Release safety switch disabled a runtime capability.',
        context: {
          route: input.route,
          mode: decision.mode,
          reasonCode: primaryReasonCode,
        },
      });
      observability?.metrics.counter(metricNames.releaseSwitchDisabledTotal, 1, {
        route: input.route,
        mode: decision.mode,
        reasonCode: primaryReasonCode,
        governanceMode: platformPolicies.requestGovernance.mode,
        incidentSeverity: incident.severity,
      });
    }

    if (decision.degradationPlan.disableNarrative || decision.degradationPlan.forceRuleOnlyNarrative) {
      observability?.logger.event(observabilityEvents.releaseGuardDegraded, {
        level: 'warn',
        message: 'Release guard degraded request execution.',
        errorCode: normalizedReasonCode,
        context: {
          route: input.route,
          mode: decision.mode,
          governanceMode: platformPolicies.requestGovernance.mode,
          incidentSeverity: incident.severity,
          disableNarrative: decision.degradationPlan.disableNarrative,
          forceRuleOnlyNarrative: decision.degradationPlan.forceRuleOnlyNarrative,
        },
      });
      observability?.metrics.counter(metricNames.releaseGuardDegradedTotal, 1, {
        route: input.route,
        mode: decision.mode,
        reasonCode: primaryReasonCode,
        governanceMode: platformPolicies.requestGovernance.mode,
        incidentSeverity: incident.severity,
      });
    }

    if (decision.degradationPlan.forceRuleOnlyNarrative) {
      observability?.logger.event(observabilityEvents.releaseNarrativeForcedRuleOnly, {
        level: 'warn',
        message: 'Release guard forced narrative generation to RuleOnly.',
        context: {
          route: input.route,
          mode: decision.mode,
          governanceMode: platformPolicies.requestGovernance.mode,
          incidentSeverity: incident.severity,
        },
      });
      observability?.metrics.counter(metricNames.releaseNarrativeForcedRuleOnlyTotal, 1, {
        route: input.route,
        mode: decision.mode,
        reasonCode: primaryReasonCode,
        governanceMode: platformPolicies.requestGovernance.mode,
        incidentSeverity: incident.severity,
      });
    }
  }

  evaluate(input: ReleaseGuardInput): ReleaseGuardDecision {
    const incident = this.switchProvider.getIncidentState();
    const configuredMode = this.switchProvider.getSafetyMode();
    const mode = incident.active ? incident.mode : configuredMode;
    const incidentLike = incident.active || mode === 'INCIDENT';
    const degradedMode = mode === 'DEGRADED';
    const wantsNarrative = input.requestedNarrativeProvider === 'minimax';
    let decision: ReleaseGuardDecision;

    if (input.route === '/api/analyze') {
      if (!this.switchProvider.isEnabled('ANALYZE_ENABLED')) {
        decision = asDecision({
          allowed: false,
          mode,
          degradationPlan: { disableAnalyze: true },
          reasonCodes: ['RELEASE_ANALYZE_DISABLED'],
          httpStatus: 503,
        });
      } else if (input.hasCluster && !this.switchProvider.isEnabled('CLUSTER_ANALYSIS_ENABLED')) {
        decision = asDecision({
          allowed: false,
          mode,
          degradationPlan: { disableClusterAnalysis: true },
          reasonCodes: ['RELEASE_CLUSTER_DISABLED'],
          httpStatus: 503,
        });
      } else if (incidentLike && input.hasCluster) {
        decision = asDecision({
          allowed: false,
          mode: 'INCIDENT',
          degradationPlan: { disableClusterAnalysis: true },
          reasonCodes: ['RELEASE_INCIDENT_CLUSTER_DISABLED'],
          httpStatus: 503,
        });
      } else if (wantsNarrative && !this.switchProvider.isEnabled('NARRATIVE_ENABLED')) {
        decision = asDecision({
          allowed: true,
          mode,
          degradationPlan: { disableNarrative: true },
          reasonCodes: ['RELEASE_NARRATIVE_DISABLED'],
        });
      } else if (wantsNarrative && !this.switchProvider.isEnabled('MINIMAX_ENABLED')) {
        decision = asDecision({
          allowed: true,
          mode,
          degradationPlan: { forceRuleOnlyNarrative: true },
          reasonCodes: ['RELEASE_MINIMAX_DISABLED'],
        });
      } else if (wantsNarrative && degradedMode) {
        decision = asDecision({
          allowed: true,
          mode: 'DEGRADED',
          degradationPlan: { forceRuleOnlyNarrative: true },
          reasonCodes: ['RELEASE_DEGRADED_FORCE_RULE_ONLY'],
          warnings: ['release-safety-degraded'],
        });
      } else if (incidentLike && wantsNarrative && (incident.severity === 'HIGH' || incident.severity === 'CRITICAL')) {
        decision = asDecision({
          allowed: true,
          mode: 'INCIDENT',
          degradationPlan: { disableNarrative: true },
          reasonCodes: ['RELEASE_INCIDENT_NARRATIVE_DISABLED'],
        });
      } else if (incidentLike && wantsNarrative) {
        decision = asDecision({
          allowed: true,
          mode: 'INCIDENT',
          degradationPlan: { forceRuleOnlyNarrative: true },
          reasonCodes: ['RELEASE_INCIDENT_FORCE_RULE_ONLY'],
        });
      } else {
        decision = asDecision({
          allowed: true,
          mode,
        });
      }
    } else {
      if (!this.switchProvider.isEnabled('SUGGEST_ENABLED')) {
        decision = asDecision({
          allowed: false,
          mode,
          degradationPlan: { disableSuggest: true },
          reasonCodes: ['RELEASE_SUGGEST_DISABLED'],
          httpStatus: 503,
        });
      } else if (incidentLike) {
        decision = asDecision({
          allowed: false,
          mode: 'INCIDENT',
          degradationPlan: { disableSuggest: true },
          reasonCodes: ['RELEASE_INCIDENT_SUGGEST_DISABLED'],
          httpStatus: 503,
        });
      } else {
        decision = asDecision({
          allowed: true,
          mode,
        });
      }
    }

    this.emitMetricsAndLogs(input, decision, incident);

    return decision;
  }
}
