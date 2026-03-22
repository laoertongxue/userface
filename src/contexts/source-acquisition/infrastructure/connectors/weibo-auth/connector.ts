import type {
  AcquisitionContext,
  ConnectorSnapshot,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { StubCommunityConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/base';

export class WeiboOauthConnector extends StubCommunityConnector {
  readonly community = 'weibo' as const;
  readonly mode = 'oauth' as const;
  readonly capabilities = {
    publicProfile: false,
    publicTopics: false,
    publicReplies: false,
    requiresAuth: true,
    supportsPagination: true,
    supportsCrossCommunityHints: false,
  };

  protected override buildPlaceholderWarning(message: string) {
    return {
      code: 'LOGIN_REQUIRED' as const,
      message,
    };
  }

  override async probe(ref: ExternalAccountRef) {
    return {
      ok: false,
      community: this.community,
      ref,
      warnings: [
        {
          code: 'LOGIN_REQUIRED' as const,
          message: 'Weibo connector is reserved for the future OAuth flow and requires user authorization.',
        },
      ],
    };
  }

  override async fetchSnapshot(
    input: FetchSnapshotInput,
    _ctx: AcquisitionContext,
  ): Promise<ConnectorSnapshot> {
    return {
      ref: input.ref,
      profile: null,
      activities: [],
      diagnostics: {
        fetchedPages: 0,
        fetchedItems: 0,
        elapsedMs: 0,
        degraded: true,
        usedRoutes: [],
      },
      warnings: [
        {
          code: 'LOGIN_REQUIRED',
          message: 'Weibo connector is reserved for the future OAuth flow and requires user authorization.',
        },
      ],
    };
  }
}
