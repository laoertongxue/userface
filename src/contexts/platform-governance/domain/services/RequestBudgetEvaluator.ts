import type { RequestBudget } from '@/src/contexts/platform-governance/domain/entities/RequestBudget';
import type { RuntimeExecutionPolicy } from '@/src/contexts/platform-governance/domain/entities/RuntimeExecutionPolicy';
import type { RequestComplexitySnapshot } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import { calculateClusterComplexityScore } from '@/src/contexts/platform-governance/domain/services/RequestGovernancePolicy';

export type RequestBudgetEvaluation = {
  requestBodyExceeded: boolean;
  accountsExceeded: boolean;
  communitiesExceeded: boolean;
  suggestionPairsExceeded: boolean;
  clusterComplexityExceeded: boolean;
  narrativeBudgetExceeded: boolean;
  complexityScore: number;
};

export class RequestBudgetEvaluator {
  evaluate(
    snapshot: RequestComplexitySnapshot,
    budget: RequestBudget,
    executionPolicy: RuntimeExecutionPolicy,
  ): RequestBudgetEvaluation {
    const complexityScore = calculateClusterComplexityScore(snapshot);
    const requestBodyExceeded = snapshot.requestBodyBytes > budget.maxRequestBodyBytes;
    const accountsExceeded = snapshot.accountCount > budget.maxAccountsPerRequest;
    const communitiesExceeded = snapshot.uniqueCommunities > budget.maxCommunitiesPerRequest;
    const suggestionPairsExceeded =
      snapshot.estimatedSuggestionPairs > budget.maxSuggestionPairsPerRequest;
    const clusterComplexityExceeded =
      snapshot.hasCluster && complexityScore > budget.maxClusterComplexityScore;
    const narrativeBudgetExceeded =
      snapshot.hasNarrative &&
      (!executionPolicy.allowNarrative ||
        snapshot.estimatedNarrativeCalls > budget.maxNarrativeCallsPerRequest ||
        complexityScore > budget.maxNarrativeComplexityScore);

    return {
      requestBodyExceeded,
      accountsExceeded,
      communitiesExceeded,
      suggestionPairsExceeded,
      clusterComplexityExceeded,
      narrativeBudgetExceeded,
      complexityScore,
    };
  }
}
