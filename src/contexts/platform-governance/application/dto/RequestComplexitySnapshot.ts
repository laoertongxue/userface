import type { GovernanceMode } from '@/src/contexts/platform-governance/domain/value-objects/GovernanceMode';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';

export type GovernedRoute = '/api/analyze' | '/api/identity/suggest';
export type GovernedRequestKind = 'ANALYZE' | 'IDENTITY_SUGGEST';
export type RequestClusterMode = 'single' | 'cluster';

export type RequestComplexitySnapshot = {
  kind: GovernedRequestKind;
  route: GovernedRoute;
  requestBodyBytes: number;
  requestedAt: string;
  requesterFingerprint: string;
  governanceMode: GovernanceMode;
  accountCount: number;
  uniqueCommunities: number;
  clusterMode: RequestClusterMode;
  narrativeMode: NarrativeMode;
  estimatedNarrativeCalls: number;
  estimatedSuggestionPairs: number;
  estimatedClusterPairs: number;
  hasCluster: boolean;
  hasNarrative: boolean;
  suggestionDecisionCount?: number;
};

type AnalyzeSnapshotInput = {
  requestBodyBytes: number;
  requestedAt: string;
  requesterFingerprint: string;
  governanceMode: GovernanceMode;
  accounts: Array<{ community: string }>;
  llmProvider?: 'minimax' | 'none';
};

type SuggestSnapshotInput = {
  requestBodyBytes: number;
  requestedAt: string;
  requesterFingerprint: string;
  governanceMode: GovernanceMode;
  accounts: Array<{ community: string }>;
};

function countUniqueCommunities(accounts: Array<{ community: string }>): number {
  return new Set(accounts.map((account) => account.community)).size;
}

function countPairs(count: number): number {
  return count <= 1 ? 0 : (count * (count - 1)) / 2;
}

export function createAnalyzeRequestComplexitySnapshot(
  input: AnalyzeSnapshotInput,
): RequestComplexitySnapshot {
  const accountCount = input.accounts.length;
  const uniqueCommunities = countUniqueCommunities(input.accounts);
  const hasCluster = accountCount > 1;
  const narrativeMode = input.llmProvider === 'minimax' ? 'LLM_ASSISTED' : 'OFF';

  return {
    kind: 'ANALYZE',
    route: '/api/analyze',
    requestBodyBytes: input.requestBodyBytes,
    requestedAt: input.requestedAt,
    requesterFingerprint: input.requesterFingerprint,
    governanceMode: input.governanceMode,
    accountCount,
    uniqueCommunities,
    clusterMode: hasCluster ? 'cluster' : 'single',
    narrativeMode,
    estimatedNarrativeCalls: narrativeMode === 'LLM_ASSISTED' ? 1 : 0,
    estimatedSuggestionPairs: 0,
    estimatedClusterPairs: countPairs(accountCount),
    hasCluster,
    hasNarrative: narrativeMode === 'LLM_ASSISTED',
    suggestionDecisionCount: 0,
  };
}

export function createSuggestRequestComplexitySnapshot(
  input: SuggestSnapshotInput,
): RequestComplexitySnapshot {
  const accountCount = input.accounts.length;

  return {
    kind: 'IDENTITY_SUGGEST',
    route: '/api/identity/suggest',
    requestBodyBytes: input.requestBodyBytes,
    requestedAt: input.requestedAt,
    requesterFingerprint: input.requesterFingerprint,
    governanceMode: input.governanceMode,
    accountCount,
    uniqueCommunities: countUniqueCommunities(input.accounts),
    clusterMode: accountCount > 1 ? 'cluster' : 'single',
    narrativeMode: 'OFF',
    estimatedNarrativeCalls: 0,
    estimatedSuggestionPairs: countPairs(accountCount),
    estimatedClusterPairs: countPairs(accountCount),
    hasCluster: accountCount > 1,
    hasNarrative: false,
    suggestionDecisionCount: 0,
  };
}
