import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export type CommunityId = 'v2ex' | 'guozaoke' | 'weibo';
export type ConnectorMode = 'public' | 'oauth';
export type ActivityType = 'topic' | 'reply';

export interface ExternalAccountRef {
  community: CommunityId;
  handle: string;
  uid?: string;
  homepageUrl?: string;
}

export interface FetchWindow {
  maxPages: number;
  maxItems: number;
  since?: string;
  until?: string;
}

export interface FetchSnapshotInput {
  ref: ExternalAccountRef;
  window: FetchWindow;
  include: Array<'profile' | 'topics' | 'replies'>;
}

export interface ConnectorCapabilities {
  publicProfile: boolean;
  publicTopics: boolean;
  publicReplies: boolean;
  requiresAuth: boolean;
  supportsPagination: boolean;
  supportsCrossCommunityHints: boolean;
}

export interface AcquisitionContext {
  traceId: string;
  timeoutMs: number;
  locale: 'zh-CN' | 'en-US';
  observability?: ObservabilityContext;
  auth?: {
    bearerToken?: string;
    cookie?: string;
  };
}

export type ConnectorWarningCode =
  | 'NOT_FOUND'
  | 'PARTIAL_RESULT'
  | 'TOPICS_HIDDEN'
  | 'LOGIN_REQUIRED'
  | 'RATE_LIMITED'
  | 'SELECTOR_CHANGED'
  | 'UNSUPPORTED';

export interface ConnectorWarning {
  code: ConnectorWarningCode;
  message: string;
}

export interface ConnectorProbeResult {
  ok: boolean;
  community: CommunityId;
  ref: ExternalAccountRef;
  resolvedUrl?: string;
  warnings: ConnectorWarning[];
}

export interface CommunityProfileSnapshot {
  community: CommunityId;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  homepageUrl?: string;
  registeredAt?: string;
  stats: {
    topics?: number;
    replies?: number;
    favorites?: number;
    followers?: number;
  };
}

export interface CanonicalActivity {
  id: string;
  community: CommunityId;
  handle: string;
  type: ActivityType;
  url: string;
  topicId?: string;
  topicTitle?: string;
  nodeName?: string;
  contentText: string;
  excerpt: string;
  publishedAt: string;
  stats?: {
    replyCount?: number;
    thanksCount?: number;
    favoriteCount?: number;
    clickCount?: number;
  };
  sourceTrace: {
    route: string;
    fetchedAt: string;
    contentHash: string;
  };
}

export interface ConnectorDiagnostics {
  fetchedPages: number;
  fetchedItems: number;
  elapsedMs: number;
  degraded: boolean;
  usedRoutes: string[];
}

export interface ConnectorSnapshot {
  ref: ExternalAccountRef;
  profile: CommunityProfileSnapshot | null;
  activities: CanonicalActivity[];
  diagnostics: ConnectorDiagnostics;
  warnings: ConnectorWarning[];
}
