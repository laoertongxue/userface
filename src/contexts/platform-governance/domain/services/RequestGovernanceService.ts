import type { GovernanceDecision } from '@/src/contexts/platform-governance/application/dto/GovernanceDecision';
import type { EnforceRequestGovernanceInput } from '@/src/contexts/platform-governance/application/dto/EnforceRequestGovernanceInput';
import type { AbuseSignal } from '@/src/contexts/platform-governance/domain/entities/AbuseSignal';
import { AbuseSignalEvaluator } from '@/src/contexts/platform-governance/domain/services/AbuseSignalEvaluator';
import { RequestBudgetEvaluator } from '@/src/contexts/platform-governance/domain/services/RequestBudgetEvaluator';
import {
  defaultRateLimitAdapter,
  InMemoryRateLimitAdapter,
} from '@/src/contexts/platform-governance/infrastructure/governance/InMemoryRateLimitAdapter';
import type { RateLimitAdapter } from '@/src/contexts/platform-governance/infrastructure/governance/RateLimitAdapter';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

function baseDecision(input: {
  abuseSignals: AbuseSignal[];
  complexityScore: number;
}): GovernanceDecision {
  return {
    allowed: true,
    degraded: false,
    disableNarrative: false,
    abuseSignals: input.abuseSignals,
    complexityScore: input.complexityScore,
  };
}

export class RequestGovernanceService {
  constructor(
    private readonly rateLimitAdapter: RateLimitAdapter = defaultRateLimitAdapter,
    private readonly budgetEvaluator: RequestBudgetEvaluator = new RequestBudgetEvaluator(),
    private readonly abuseSignalEvaluator: AbuseSignalEvaluator = new AbuseSignalEvaluator(),
  ) {}

  async enforce(input: EnforceRequestGovernanceInput): Promise<GovernanceDecision> {
    const observability = input.observability?.child('governance.request');
    const rateLimitKey = `${input.snapshot.route}:${input.snapshot.requesterFingerprint}`;
    const rateLimitResult = await this.rateLimitAdapter.consume(rateLimitKey, {
      maxRequests: input.requestBudget.maxRequests,
      windowSeconds: input.requestBudget.windowSeconds,
    });
    const evaluation = this.budgetEvaluator.evaluate(
      input.snapshot,
      input.requestBudget,
      input.executionPolicy,
    );
    const abuseSignals = this.abuseSignalEvaluator.evaluate({
      snapshot: input.snapshot,
      budget: input.requestBudget,
      evaluation,
      rateLimited: !rateLimitResult.allowed,
    });

    let decision = baseDecision({
      abuseSignals,
      complexityScore: evaluation.complexityScore,
    });

    if (!rateLimitResult.allowed) {
      decision = {
        ...decision,
        allowed: false,
        errorCode: 'GOVERNANCE_RATE_LIMITED',
        httpStatus: 429,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        message: 'Request rejected because the current route-level rate limit was exceeded.',
      };
    } else if (evaluation.requestBodyExceeded) {
      decision = {
        ...decision,
        allowed: false,
        errorCode: 'GOVERNANCE_PAYLOAD_TOO_LARGE',
        httpStatus: 413,
        message: 'Request rejected because the payload exceeded the allowed governance limit.',
      };
    } else if (evaluation.accountsExceeded) {
      decision = {
        ...decision,
        allowed: false,
        errorCode: 'GOVERNANCE_TOO_MANY_ACCOUNTS',
        httpStatus: 400,
        message: 'Request rejected because too many accounts were included.',
      };
    } else if (evaluation.suggestionPairsExceeded) {
      decision = {
        ...decision,
        allowed: false,
        errorCode: 'GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS',
        httpStatus: 400,
        message: 'Request rejected because the estimated suggestion pairs exceeded the allowed limit.',
      };
    } else if (evaluation.clusterComplexityExceeded || evaluation.communitiesExceeded) {
      decision = {
        ...decision,
        allowed: false,
        errorCode: 'GOVERNANCE_CLUSTER_COMPLEXITY_EXCEEDED',
        httpStatus: 400,
        message: 'Request rejected because cluster complexity exceeded the allowed governance limit.',
      };
    } else if (evaluation.narrativeBudgetExceeded) {
      decision = {
        ...decision,
        allowed: true,
        degraded: true,
        disableNarrative: true,
        errorCode: 'GOVERNANCE_NARRATIVE_DISABLED',
        message: 'Narrative enhancement was disabled because the request exceeded the narrative budget.',
      };
    }

    observability?.logger.event(observabilityEvents.governanceRequestEvaluated, {
      message: 'Request governance decision evaluated.',
      context: {
        route: input.snapshot.route,
        governanceMode: input.snapshot.governanceMode,
        allowed: decision.allowed,
        degraded: decision.degraded,
        disableNarrative: decision.disableNarrative,
        errorCode: decision.errorCode,
        complexityScore: evaluation.complexityScore,
      },
    });
    observability?.metrics.counter(metricNames.governanceRequestTotal, 1, {
      route: input.snapshot.route,
      outcome: decision.allowed ? (decision.degraded ? 'degraded' : 'allowed') : 'rejected',
      governanceMode: input.snapshot.governanceMode,
      errorCode: decision.errorCode ?? 'none',
    });

    if (!decision.allowed) {
      observability?.logger.event(observabilityEvents.governanceRequestRejected, {
        level: 'warn',
        message: 'Request rejected by governance policy.',
        context: {
          route: input.snapshot.route,
          governanceMode: input.snapshot.governanceMode,
          errorCode: decision.errorCode,
          retryAfterSeconds: decision.retryAfterSeconds,
          complexityScore: evaluation.complexityScore,
        },
      });
      observability?.metrics.counter(metricNames.governanceRequestRejectedTotal, 1, {
        route: input.snapshot.route,
        outcome: 'rejected',
        governanceMode: input.snapshot.governanceMode,
        errorCode: decision.errorCode ?? 'none',
      });
    }

    if (!rateLimitResult.allowed) {
      observability?.logger.event(observabilityEvents.governanceRateLimitHit, {
        level: 'warn',
        message: 'Route-level rate limit was hit.',
        context: {
          route: input.snapshot.route,
          governanceMode: input.snapshot.governanceMode,
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        },
      });
      observability?.metrics.counter(metricNames.governanceRateLimitHitTotal, 1, {
        route: input.snapshot.route,
        outcome: 'rate_limited',
        governanceMode: input.snapshot.governanceMode,
        errorCode: decision.errorCode ?? 'none',
      });
    }

    if (decision.degraded) {
      observability?.logger.event(observabilityEvents.governanceRequestDegraded, {
        level: 'warn',
        message: 'Request was allowed with governance degradation.',
        context: {
          route: input.snapshot.route,
          governanceMode: input.snapshot.governanceMode,
          disableNarrative: decision.disableNarrative,
          errorCode: decision.errorCode,
        },
      });
      observability?.metrics.counter(metricNames.governanceRequestDegradedTotal, 1, {
        route: input.snapshot.route,
        outcome: 'degraded',
        governanceMode: input.snapshot.governanceMode,
        errorCode: decision.errorCode ?? 'none',
      });
    }

    if (decision.disableNarrative) {
      observability?.logger.event(observabilityEvents.governanceNarrativeDisabled, {
        level: 'warn',
        message: 'Narrative enhancement was disabled by governance.',
        context: {
          route: input.snapshot.route,
          governanceMode: input.snapshot.governanceMode,
          complexityScore: evaluation.complexityScore,
        },
      });
      observability?.metrics.counter(metricNames.governanceNarrativeDisabledTotal, 1, {
        route: input.snapshot.route,
        outcome: 'disabled',
        governanceMode: input.snapshot.governanceMode,
        errorCode: decision.errorCode ?? 'none',
      });
    }

    return decision;
  }
}
