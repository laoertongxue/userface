import type { GovernanceMode } from '@/src/contexts/platform-governance/domain/value-objects/GovernanceMode';
import type { RequestComplexitySnapshot } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import {
  createRequestBudget,
  type RequestBudget,
} from '@/src/contexts/platform-governance/domain/entities/RequestBudget';
import {
  createRuntimeExecutionPolicy,
  type RuntimeExecutionPolicy,
} from '@/src/contexts/platform-governance/domain/entities/RuntimeExecutionPolicy';

export function calculateClusterComplexityScore(snapshot: RequestComplexitySnapshot): number {
  const accountWeight = snapshot.accountCount;
  const communityWeight = Math.max(0, snapshot.uniqueCommunities - 1) * 2;
  const pairWeight = snapshot.estimatedClusterPairs;
  const suggestionWeight = snapshot.kind === 'IDENTITY_SUGGEST' ? snapshot.estimatedSuggestionPairs : 0;
  const narrativeWeight = snapshot.hasNarrative ? 1 : 0;

  return accountWeight + communityWeight + pairWeight + suggestionWeight + narrativeWeight;
}

export const requestGovernancePolicy = {
  mode: 'BASELINE' as GovernanceMode,
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
  analyzeBudget: createRequestBudget({
    scope: 'ANALYZE',
    maxRequests: 20,
    windowSeconds: 60,
    maxRequestBodyBytes: 8_192,
    maxAccountsPerRequest: 6,
    maxCommunitiesPerRequest: 3,
    maxSuggestionPairsPerRequest: 0,
    maxNarrativeCallsPerRequest: 1,
    maxClusterComplexityScore: 18,
    maxNarrativeComplexityScore: 12,
    enabled: true,
  }),
  suggestBudget: createRequestBudget({
    scope: 'IDENTITY_SUGGEST',
    maxRequests: 30,
    windowSeconds: 60,
    maxRequestBodyBytes: 6_144,
    maxAccountsPerRequest: 8,
    maxCommunitiesPerRequest: 3,
    maxSuggestionPairsPerRequest: 15,
    maxNarrativeCallsPerRequest: 0,
    maxClusterComplexityScore: 24,
    maxNarrativeComplexityScore: 1,
    enabled: true,
  }),
} as const satisfies {
  mode: GovernanceMode;
  executionPolicy: RuntimeExecutionPolicy;
  analyzeBudget: RequestBudget;
  suggestBudget: RequestBudget;
};
