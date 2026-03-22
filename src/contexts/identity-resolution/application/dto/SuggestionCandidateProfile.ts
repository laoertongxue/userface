import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';

export type SuggestionCandidateProfile = {
  account: ClusterAccountRef;
  displayName?: string;
  homepageUrl?: string;
  bio?: string;
  avatarUrl?: string;
  uid?: string;
  profileAvailable: boolean;
  warningCodes: string[];
};
