import { NodeHashService } from '@/src/shared/contracts/HashService';
import type { AccountLink } from '@/src/contexts/identity-resolution/domain/entities/AccountLink';
import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { ClusterAnalysisMode } from '@/src/contexts/identity-resolution/domain/value-objects/ClusterAnalysisMode';

export type IdentityCluster = {
  id: string;
  label?: string;
  accounts: ClusterAccountRef[];
  links: AccountLink[];
  mode: ClusterAnalysisMode;
  createdAt: string;
  updatedAt: string;
  primaryAccountRef?: ClusterAccountRef;
};

export type CreateIdentityClusterInput = {
  label?: string;
  accounts: ClusterAccountRef[];
  links?: AccountLink[];
  mode: ClusterAnalysisMode;
  primaryAccountRef?: ClusterAccountRef;
  now?: string;
};

const hashService = new NodeHashService();

export function clusterAccountKey(account: Pick<ClusterAccountRef, 'community' | 'handle'>): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

export function normalizeClusterAccountRef(account: ClusterAccountRef): ClusterAccountRef {
  return {
    ...account,
    handle: account.handle.trim(),
    displayName: account.displayName?.trim() || undefined,
    homepageUrl: account.homepageUrl?.trim() || undefined,
  };
}

function buildClusterId(accounts: ClusterAccountRef[]): string {
  const identityKey = accounts.map(clusterAccountKey).sort().join('|');
  return hashService.sha256(`identity-cluster:${identityKey}`);
}

function dedupeLinks(links: AccountLink[], accountKeys: Set<string>): AccountLink[] {
  const seen = new Set<string>();

  return links.filter((link) => {
    const fromKey = clusterAccountKey(link.from);
    const toKey = clusterAccountKey(link.to);

    if (!accountKeys.has(fromKey) || !accountKeys.has(toKey)) {
      throw new Error('IdentityCluster links must point to accounts that belong to the cluster.');
    }

    if (fromKey === toKey) {
      throw new Error('IdentityCluster links cannot point from an account to itself.');
    }

    const relationKey = [fromKey, toKey].sort().join('<->');
    const dedupeKey = `${relationKey}:${link.source}`;

    if (seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
}

export function createIdentityCluster(input: CreateIdentityClusterInput): IdentityCluster {
  if (input.accounts.length === 0) {
    throw new Error('IdentityCluster must contain at least one account.');
  }

  const normalizedAccounts = input.accounts.map(normalizeClusterAccountRef);
  const accountKeys = normalizedAccounts.map(clusterAccountKey);
  const uniqueAccountKeys = new Set(accountKeys);

  if (uniqueAccountKeys.size !== normalizedAccounts.length) {
    throw new Error('IdentityCluster accounts must be unique by community and handle.');
  }

  if (input.mode === 'SINGLE_ACCOUNT' && normalizedAccounts.length !== 1) {
    throw new Error('SINGLE_ACCOUNT clusters must contain exactly one account.');
  }

  const primaryAccountRef = input.primaryAccountRef
    ? normalizeClusterAccountRef(input.primaryAccountRef)
    : normalizedAccounts[0];
  const primaryKey = clusterAccountKey(primaryAccountRef);

  if (!uniqueAccountKeys.has(primaryKey)) {
    throw new Error('IdentityCluster primaryAccountRef must belong to the cluster.');
  }

  const now = input.now ?? new Date().toISOString();

  return {
    id: buildClusterId(normalizedAccounts),
    label: input.label,
    accounts: normalizedAccounts,
    links: dedupeLinks(input.links ?? [], uniqueAccountKeys),
    mode: input.mode,
    createdAt: now,
    updatedAt: now,
    primaryAccountRef,
  };
}
