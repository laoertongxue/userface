import type { IdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { ClusterAnalysisScope } from '@/src/contexts/identity-resolution/domain/value-objects/ClusterAnalysisScope';

export type ClusterAnalysisInput = {
  cluster: IdentityCluster;
  scope: ClusterAnalysisScope;
};
