import type { IdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { ActivityStream } from '@/src/contexts/activity-normalization/application/use-cases/BuildCanonicalActivityStream';
import type { ConnectorSnapshot } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export type AnalyzePortraitInput = {
  identityCluster: IdentityCluster;
  snapshots: ConnectorSnapshot[];
  activityStream: ActivityStream;
};
