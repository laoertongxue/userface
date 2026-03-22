import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { MergeSuggestion } from '@/src/contexts/identity-resolution/domain/entities/MergeSuggestion';

export type IgnoredSuggestionPair = {
  from: ClusterAccountRef;
  to: ClusterAccountRef;
  reason: string;
};

export type SuggestIdentityLinksWarning = {
  code: string;
  message: string;
};

export type SuggestIdentityLinksResult = {
  suggestions: MergeSuggestion[];
  inspectedAccounts: ClusterAccountRef[];
  ignoredPairs: IgnoredSuggestionPair[];
  warnings: SuggestIdentityLinksWarning[];
};
