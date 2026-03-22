import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import { GuozaokeConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/connector';
import { V2exConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/connector';
import { WeiboOauthConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/weibo-auth/connector';

export class StaticConnectorRegistry implements ConnectorRegistry {
  private readonly connectors = new Map<CommunityId, CommunityConnector>();

  constructor() {
    const instances: CommunityConnector[] = [
      new V2exConnector(),
      new GuozaokeConnector(),
      new WeiboOauthConnector(),
    ];

    instances.forEach((connector) => {
      this.connectors.set(connector.community, connector);
    });
  }

  get(community: CommunityId): CommunityConnector {
    const connector = this.connectors.get(community);

    if (!connector) {
      throw new Error(`Unknown connector: ${community}`);
    }

    return connector;
  }

  list(): CommunityConnector[] {
    return [...this.connectors.values()];
  }
}
