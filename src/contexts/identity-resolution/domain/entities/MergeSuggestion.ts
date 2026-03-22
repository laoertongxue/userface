import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';

export const mergeSuggestionStatusValues = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type MergeSuggestionStatus = (typeof mergeSuggestionStatusValues)[number];

export type MergeSuggestion = {
  candidateAccounts: ClusterAccountRef[];
  confidence: number;
  reasons: string[];
  status: MergeSuggestionStatus;
  sourceHint?: string;
};
