import { StubCommunityConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/base';

export class V2exConnector extends StubCommunityConnector {
  readonly community = 'v2ex' as const;
  readonly mode = 'public' as const;
  readonly capabilities = {
    publicProfile: true,
    publicTopics: true,
    publicReplies: true,
    requiresAuth: false,
    supportsPagination: true,
    supportsCrossCommunityHints: false,
  };
}
