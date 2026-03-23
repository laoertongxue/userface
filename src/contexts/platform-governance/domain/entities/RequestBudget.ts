export const requestBudgetScopeValues = [
  'ANALYZE',
  'IDENTITY_SUGGEST',
  'NARRATIVE_GENERATION',
  'CONNECTOR_FETCH',
  'CLUSTER_ANALYSIS',
] as const;

export type RequestBudgetScope = (typeof requestBudgetScopeValues)[number];

export type RequestBudget = {
  scope: RequestBudgetScope;
  maxRequests: number;
  windowSeconds: number;
  maxRequestBodyBytes: number;
  maxAccountsPerRequest: number;
  maxCommunitiesPerRequest: number;
  maxSuggestionPairsPerRequest: number;
  maxNarrativeCallsPerRequest: number;
  maxClusterComplexityScore: number;
  maxNarrativeComplexityScore: number;
  enabled: boolean;
};

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
}

export function createRequestBudget(input: RequestBudget): RequestBudget {
  assertPositiveInteger(input.maxRequests, 'RequestBudget.maxRequests');
  assertPositiveInteger(input.windowSeconds, 'RequestBudget.windowSeconds');
  assertPositiveInteger(input.maxRequestBodyBytes, 'RequestBudget.maxRequestBodyBytes');
  assertPositiveInteger(input.maxAccountsPerRequest, 'RequestBudget.maxAccountsPerRequest');
  assertPositiveInteger(
    input.maxCommunitiesPerRequest,
    'RequestBudget.maxCommunitiesPerRequest',
  );
  assertNonNegativeInteger(
    input.maxSuggestionPairsPerRequest,
    'RequestBudget.maxSuggestionPairsPerRequest',
  );
  assertNonNegativeInteger(
    input.maxNarrativeCallsPerRequest,
    'RequestBudget.maxNarrativeCallsPerRequest',
  );
  assertPositiveInteger(
    input.maxClusterComplexityScore,
    'RequestBudget.maxClusterComplexityScore',
  );
  assertPositiveInteger(
    input.maxNarrativeComplexityScore,
    'RequestBudget.maxNarrativeComplexityScore',
  );

  return {
    ...input,
    enabled: input.enabled,
  };
}
