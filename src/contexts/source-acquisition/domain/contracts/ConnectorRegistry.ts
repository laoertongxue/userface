import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';

export interface ConnectorRegistry {
  get(community: CommunityId): CommunityConnector;
  list(): CommunityConnector[];
}
