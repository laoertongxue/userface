import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { ClusterAnalysisMode } from '@/src/contexts/identity-resolution/domain/value-objects/ClusterAnalysisMode';

export type ResolveIdentityInput = {
  label?: string;
  accounts: ClusterAccountRef[];
  mode?: ClusterAnalysisMode;
};
