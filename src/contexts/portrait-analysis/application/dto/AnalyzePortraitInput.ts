import type { IdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { ActivityStream } from '@/src/contexts/activity-normalization/application/use-cases/BuildCanonicalActivityStream';
import type { ConnectorSnapshot } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { ClusterMergeResult } from '@/src/contexts/portrait-analysis/application/dto/ClusterMergeResult';
import type { FetchIdentityClusterSnapshotsResult } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export type AnalyzePortraitInput = {
  identityCluster: IdentityCluster;
  snapshots: ConnectorSnapshot[];
  activityStream?: ActivityStream;
  clusterMergeResult?: ClusterMergeResult;
  fetchResult?: FetchIdentityClusterSnapshotsResult;
  observability?: ObservabilityContext;
};
