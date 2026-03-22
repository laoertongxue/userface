import type {
  CanonicalActivity,
  CommunityId,
  CommunityProfileSnapshot,
  ConnectorWarning,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';

export type ClusterAccountProfileResult = {
  account: ClusterAccountRef;
  profile: CommunityProfileSnapshot | null;
};

export type ClusterAccountWarningResult = {
  account: ClusterAccountRef;
  warnings: ConnectorWarning[];
  degraded: boolean;
  successful: boolean;
};

export type ClusterMergeResult = {
  mergedActivities: CanonicalActivity[];
  perAccountProfiles: ClusterAccountProfileResult[];
  perAccountWarnings: ClusterAccountWarningResult[];
  clusterWarnings: ConnectorWarning[];
  degraded: boolean;
  successfulAccountCount: number;
  failedAccountCount: number;
  activeCommunities: CommunityId[];
};
