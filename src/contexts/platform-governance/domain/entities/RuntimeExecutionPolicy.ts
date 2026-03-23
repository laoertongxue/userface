export type RuntimeExecutionPolicy = {
  maxDurationMs: number;
  maxConnectorConcurrency: number;
  maxProviderConcurrency: number;
  allowNarrative: boolean;
  allowSuggestion: boolean;
  allowClusterAnalysis: boolean;
  fallbackOnProviderFailure: boolean;
  failFastOnAllConnectorFailure: boolean;
};

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

export function createRuntimeExecutionPolicy(
  input: RuntimeExecutionPolicy,
): RuntimeExecutionPolicy {
  assertPositiveInteger(input.maxDurationMs, 'RuntimeExecutionPolicy.maxDurationMs');
  assertPositiveInteger(
    input.maxConnectorConcurrency,
    'RuntimeExecutionPolicy.maxConnectorConcurrency',
  );
  assertPositiveInteger(
    input.maxProviderConcurrency,
    'RuntimeExecutionPolicy.maxProviderConcurrency',
  );

  return {
    ...input,
  };
}
