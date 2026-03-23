import { ZodError } from 'zod';
import {
  isAcquisitionError,
  type AcquisitionError,
} from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import {
  isNarrativeGatewayError,
  type NarrativeGatewayError,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';

export const normalizedErrorCodeValues = [
  'INVALID_REQUEST',
  'NOT_FOUND',
  'PARTIAL_RESULT',
  'RATE_LIMITED',
  'GOVERNANCE_PAYLOAD_TOO_LARGE',
  'GOVERNANCE_TOO_MANY_ACCOUNTS',
  'GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS',
  'GOVERNANCE_RATE_LIMITED',
  'GOVERNANCE_CLUSTER_COMPLEXITY_EXCEEDED',
  'GOVERNANCE_NARRATIVE_DISABLED',
  'RELEASE_ANALYZE_DISABLED',
  'RELEASE_CLUSTER_DISABLED',
  'RELEASE_SUGGEST_DISABLED',
  'RELEASE_NARRATIVE_DISABLED',
  'RELEASE_MINIMAX_DISABLED',
  'RELEASE_DEGRADED_FORCE_RULE_ONLY',
  'RELEASE_INCIDENT_CLUSTER_DISABLED',
  'RELEASE_INCIDENT_SUGGEST_DISABLED',
  'RELEASE_INCIDENT_FORCE_RULE_ONLY',
  'RELEASE_INCIDENT_NARRATIVE_DISABLED',
  'CONNECTOR_FAILURE',
  'CONNECTOR_SELECTOR_CHANGED',
  'CLUSTER_ALL_FAILED',
  'CLUSTER_PARTIAL_SUCCESS',
  'NARRATIVE_TIMEOUT',
  'NARRATIVE_INVALID_RESPONSE',
  'NARRATIVE_FALLBACK_USED',
  'INTERNAL_ERROR',
] as const;

export type NormalizedErrorCode = (typeof normalizedErrorCodeValues)[number];

type NormalizeErrorCodeInput = {
  error?: unknown;
  warningCode?: string;
  partialSuccess?: boolean;
  allFailed?: boolean;
  fallbackUsed?: boolean;
};

function normalizeAcquisitionError(error: AcquisitionError): NormalizedErrorCode {
  if (error.code === 'RATE_LIMITED') {
    return 'RATE_LIMITED';
  }

  if (error.status === 404) {
    return 'NOT_FOUND';
  }

  return 'CONNECTOR_FAILURE';
}

function normalizeNarrativeError(error: NarrativeGatewayError): NormalizedErrorCode {
  if (error.code === 'TIMEOUT') {
    return 'NARRATIVE_TIMEOUT';
  }

  if (error.code === 'INVALID_RESPONSE') {
    return 'NARRATIVE_INVALID_RESPONSE';
  }

  if (error.code === 'RATE_LIMITED') {
    return 'RATE_LIMITED';
  }

  return 'INTERNAL_ERROR';
}

export function normalizeErrorCode(input: NormalizeErrorCodeInput): NormalizedErrorCode {
  if (input.fallbackUsed) {
    return 'NARRATIVE_FALLBACK_USED';
  }

  if (input.allFailed) {
    return 'CLUSTER_ALL_FAILED';
  }

  if (input.partialSuccess) {
    return 'CLUSTER_PARTIAL_SUCCESS';
  }

  if (input.warningCode === 'SELECTOR_CHANGED') {
    return 'CONNECTOR_SELECTOR_CHANGED';
  }

  if (input.warningCode === 'PARTIAL_RESULT') {
    return 'PARTIAL_RESULT';
  }

  if (input.warningCode === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }

  if (input.warningCode === 'RATE_LIMITED') {
    return 'RATE_LIMITED';
  }

  if (input.error instanceof ZodError) {
    return 'INVALID_REQUEST';
  }

  if (isAcquisitionError(input.error)) {
    return normalizeAcquisitionError(input.error);
  }

  if (isNarrativeGatewayError(input.error)) {
    return normalizeNarrativeError(input.error);
  }

  if (
    input.error instanceof Error &&
    input.error.message.includes('No account snapshots could be fetched')
  ) {
    return 'CLUSTER_ALL_FAILED';
  }

  return 'INTERNAL_ERROR';
}
