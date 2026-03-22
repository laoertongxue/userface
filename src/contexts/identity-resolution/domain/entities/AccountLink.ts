import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { AccountLinkSource } from '@/src/contexts/identity-resolution/domain/value-objects/AccountLinkSource';

export type AccountLink = {
  from: ClusterAccountRef;
  to: ClusterAccountRef;
  source: AccountLinkSource;
  confidence?: number;
  rationale?: string;
};
