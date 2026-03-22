import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';

export type SuggestIdentityLinksInput = {
  accounts: ClusterAccountRef[];
  maxSuggestions?: number;
  includeWeakSignals?: boolean;
  locale?: 'zh-CN' | 'en-US';
};
