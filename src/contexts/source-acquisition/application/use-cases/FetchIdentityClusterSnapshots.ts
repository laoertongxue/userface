import type {
  AcquisitionContext,
  ConnectorSnapshot,
  ExternalAccountRef,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import { analysisConfig } from '@/src/config/analysis';

export type FetchIdentityClusterSnapshotsInput = {
  accounts: ExternalAccountRef[];
  options?: {
    maxPagesPerCommunity?: number;
    maxItemsPerCommunity?: number;
    includeTopics?: boolean;
    includeReplies?: boolean;
    locale?: 'zh-CN' | 'en-US';
  };
};

export class FetchIdentityClusterSnapshots {
  constructor(private readonly connectorRegistry: ConnectorRegistry) {}

  async execute(
    input: FetchIdentityClusterSnapshotsInput,
    ctx: AcquisitionContext,
  ): Promise<ConnectorSnapshot[]> {
    const maxPages =
      input.options?.maxPagesPerCommunity ?? analysisConfig.defaults.maxPagesPerCommunity;
    const maxItems =
      input.options?.maxItemsPerCommunity ?? analysisConfig.defaults.maxItemsPerCommunity;
    const includeTopics = input.options?.includeTopics ?? analysisConfig.defaults.includeTopics;
    const includeReplies = input.options?.includeReplies ?? analysisConfig.defaults.includeReplies;

    return Promise.all(
      input.accounts.map((account) =>
        this.connectorRegistry.get(account.community).fetchSnapshot(
          {
            ref: account,
            window: {
              maxPages,
              maxItems,
            },
            include: [
              'profile',
              ...(includeTopics ? (['topics'] as const) : []),
              ...(includeReplies ? (['replies'] as const) : []),
            ],
          },
          ctx,
        ),
      ),
    );
  }
}
