import type { IncidentSeverity } from '@/src/contexts/platform-governance/domain/value-objects/IncidentSeverity';

export const abuseSignalCodeValues = [
  'TOO_MANY_ACCOUNTS',
  'TOO_MANY_SUGGESTION_PAIRS',
  'TOO_FREQUENT_ANALYZE',
  'TOO_FREQUENT_SUGGEST',
  'OVERSIZED_INPUT',
  'EXCESSIVE_CLUSTER_COMPLEXITY',
  'NARRATIVE_BUDGET_EXCEEDED',
] as const;

export type AbuseSignalCode = (typeof abuseSignalCodeValues)[number];

export const abuseSignalSourceValues = [
  'REQUEST_GOVERNANCE',
  'ANALYZE_PIPELINE',
  'IDENTITY_SUGGESTION',
  'NARRATIVE_RUNTIME',
] as const;

export type AbuseSignalSource = (typeof abuseSignalSourceValues)[number];

export type AbuseSignalContext = Record<string, string | number | boolean | null | undefined>;

export type AbuseSignal = {
  code: AbuseSignalCode;
  severity: IncidentSeverity;
  message: string;
  source: AbuseSignalSource;
  observedValue?: number;
  threshold?: number;
  context?: AbuseSignalContext;
};

export function createAbuseSignal(input: AbuseSignal): AbuseSignal {
  if (!input.message.trim()) {
    throw new Error('AbuseSignal.message must not be empty.');
  }

  return {
    ...input,
    message: input.message.trim(),
  };
}
