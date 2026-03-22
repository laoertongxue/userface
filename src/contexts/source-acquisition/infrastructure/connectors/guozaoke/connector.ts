import { StubCommunityConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/base';

export class GuozaokeConnector extends StubCommunityConnector {
  readonly community = 'guozaoke' as const;
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
