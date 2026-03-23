import {
  createAbuseSignal,
  type AbuseSignal,
} from '@/src/contexts/platform-governance/domain/entities/AbuseSignal';
import type { RequestBudget } from '@/src/contexts/platform-governance/domain/entities/RequestBudget';
import type { RequestComplexitySnapshot } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import type { RequestBudgetEvaluation } from '@/src/contexts/platform-governance/domain/services/RequestBudgetEvaluator';

type AbuseSignalEvaluatorInput = {
  snapshot: RequestComplexitySnapshot;
  budget: RequestBudget;
  evaluation: RequestBudgetEvaluation;
  rateLimited: boolean;
};

export class AbuseSignalEvaluator {
  evaluate(input: AbuseSignalEvaluatorInput): AbuseSignal[] {
    const signals: AbuseSignal[] = [];

    if (input.evaluation.accountsExceeded) {
      signals.push(
        createAbuseSignal({
          code: 'TOO_MANY_ACCOUNTS',
          severity: 'MEDIUM',
          message: 'Account count exceeded the allowed request budget.',
          source: 'REQUEST_GOVERNANCE',
          observedValue: input.snapshot.accountCount,
          threshold: input.budget.maxAccountsPerRequest,
        }),
      );
    }

    if (input.evaluation.suggestionPairsExceeded) {
      signals.push(
        createAbuseSignal({
          code: 'TOO_MANY_SUGGESTION_PAIRS',
          severity: 'MEDIUM',
          message: 'Suggestion pair count exceeded the allowed request budget.',
          source: 'REQUEST_GOVERNANCE',
          observedValue: input.snapshot.estimatedSuggestionPairs,
          threshold: input.budget.maxSuggestionPairsPerRequest,
        }),
      );
    }

    if (input.evaluation.requestBodyExceeded) {
      signals.push(
        createAbuseSignal({
          code: 'OVERSIZED_INPUT',
          severity: 'MEDIUM',
          message: 'Request body size exceeded the allowed request budget.',
          source: 'REQUEST_GOVERNANCE',
          observedValue: input.snapshot.requestBodyBytes,
          threshold: input.budget.maxRequestBodyBytes,
        }),
      );
    }

    if (input.evaluation.clusterComplexityExceeded || input.evaluation.communitiesExceeded) {
      signals.push(
        createAbuseSignal({
          code: 'EXCESSIVE_CLUSTER_COMPLEXITY',
          severity: 'HIGH',
          message: 'Cluster request complexity exceeded the allowed budget.',
          source: 'REQUEST_GOVERNANCE',
          observedValue: input.evaluation.complexityScore,
          threshold: input.budget.maxClusterComplexityScore,
        }),
      );
    }

    if (input.evaluation.narrativeBudgetExceeded) {
      signals.push(
        createAbuseSignal({
          code: 'NARRATIVE_BUDGET_EXCEEDED',
          severity: 'LOW',
          message: 'Narrative enhancement exceeded the current request governance budget.',
          source: 'NARRATIVE_RUNTIME',
          observedValue: input.evaluation.complexityScore,
          threshold: input.budget.maxNarrativeComplexityScore,
        }),
      );
    }

    if (input.rateLimited) {
      signals.push(
        createAbuseSignal({
          code:
            input.snapshot.kind === 'ANALYZE'
              ? 'TOO_FREQUENT_ANALYZE'
              : 'TOO_FREQUENT_SUGGEST',
          severity: 'MEDIUM',
          message:
            input.snapshot.kind === 'ANALYZE'
              ? 'Analyze requests are arriving too frequently for the current budget window.'
              : 'Suggest requests are arriving too frequently for the current budget window.',
          source: 'REQUEST_GOVERNANCE',
          observedValue: input.budget.maxRequests + 1,
          threshold: input.budget.maxRequests,
        }),
      );
    }

    return signals;
  }
}
