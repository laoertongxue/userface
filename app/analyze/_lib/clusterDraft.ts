import type {
  AnalyzeMode,
  ClusterDraft,
  DraftAccount,
  SuggestionDecision,
  SuggestionDecisionStatus,
  SupportedCommunity,
} from '@/app/analyze/types';

export const CLUSTER_DRAFT_STORAGE_KEY = 'community-portrait.cluster-draft.v1';

export function createDraftAccount(
  community: SupportedCommunity = 'v2ex',
  handle = '',
): DraftAccount {
  return {
    community,
    handle,
  };
}

export function createDefaultClusterDraft(): ClusterDraft {
  return {
    mode: 'SINGLE_ACCOUNT',
    accounts: [createDraftAccount()],
    suggestionDecisions: [],
  };
}

export function normalizeDraftHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function draftAccountKey(account: { community: string; handle: string }): string {
  return `${account.community}:${normalizeDraftHandle(account.handle)}`;
}

export function pairKeyForAccounts(
  accounts: Array<{ community: string; handle: string }>,
): string {
  return [...accounts]
    .map((account) => draftAccountKey(account))
    .sort()
    .join('|');
}

export function sanitizeDraftAccounts(accounts: DraftAccount[]): DraftAccount[] {
  return accounts.map((account) => ({
    community: account.community,
    handle: account.handle.trim(),
  }));
}

export function dedupeDraftAccounts(accounts: DraftAccount[]): DraftAccount[] {
  const seen = new Set<string>();

  return sanitizeDraftAccounts(accounts).filter((account) => {
    const normalizedHandle = normalizeDraftHandle(account.handle);

    if (!normalizedHandle) {
      return true;
    }

    const key = `${account.community}:${normalizedHandle}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getEffectiveAccounts(
  mode: AnalyzeMode,
  accounts: DraftAccount[],
): DraftAccount[] {
  const source = mode === 'SINGLE_ACCOUNT' ? accounts.slice(0, 1) : accounts;

  return dedupeDraftAccounts(source).filter((account) => normalizeDraftHandle(account.handle));
}

export function buildAnalyzeRequest(mode: AnalyzeMode, accounts: DraftAccount[]) {
  const effectiveAccounts = getEffectiveAccounts(mode, accounts);

  return {
    identity: {
      accounts: effectiveAccounts.map((account) => ({
        community: account.community,
        handle: account.handle.trim(),
      })),
    },
    options: {
      locale: 'zh-CN' as const,
    },
  };
}

export function buildSuggestRequest(accounts: DraftAccount[]) {
  const effectiveAccounts = getEffectiveAccounts('MANUAL_CLUSTER', accounts);

  return {
    accounts: effectiveAccounts.map((account) => ({
      community: account.community,
      handle: account.handle.trim(),
    })),
    maxSuggestions: 10,
  };
}

export function upsertSuggestionDecision(
  decisions: SuggestionDecision[],
  pairKey: string,
  status: SuggestionDecisionStatus,
): SuggestionDecision[] {
  const next = decisions.filter((decision) => decision.pairKey !== pairKey);
  next.push({ pairKey, status });

  return next.sort((left, right) => left.pairKey.localeCompare(right.pairKey));
}

export function readClusterDraft(storage: Pick<Storage, 'getItem'> | null | undefined): ClusterDraft {
  if (!storage) {
    return createDefaultClusterDraft();
  }

  try {
    const raw = storage.getItem(CLUSTER_DRAFT_STORAGE_KEY);

    if (!raw) {
      return createDefaultClusterDraft();
    }

    const parsed = JSON.parse(raw) as Partial<ClusterDraft>;
    const mode =
      parsed.mode === 'MANUAL_CLUSTER' || parsed.mode === 'SINGLE_ACCOUNT'
        ? parsed.mode
        : 'SINGLE_ACCOUNT';
    const accounts: DraftAccount[] =
      Array.isArray(parsed.accounts) && parsed.accounts.length > 0
        ? parsed.accounts
            .map((account) => ({
              community:
                account.community === 'guozaoke' ? 'guozaoke' : 'v2ex',
              handle: typeof account.handle === 'string' ? account.handle : '',
            }))
        : [createDraftAccount()];
    const suggestionDecisions = Array.isArray(parsed.suggestionDecisions)
      ? parsed.suggestionDecisions
          .filter(
            (decision): decision is SuggestionDecision =>
              !!decision &&
              typeof decision.pairKey === 'string' &&
              (decision.status === 'PENDING' ||
                decision.status === 'ACCEPTED' ||
                decision.status === 'REJECTED'),
          )
      : [];

    return {
      mode,
      accounts,
      suggestionDecisions,
      lastSuggestedAt:
        typeof parsed.lastSuggestedAt === 'string' ? parsed.lastSuggestedAt : undefined,
      lastAnalyzedAt:
        typeof parsed.lastAnalyzedAt === 'string' ? parsed.lastAnalyzedAt : undefined,
    };
  } catch {
    return createDefaultClusterDraft();
  }
}

export function writeClusterDraft(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  draft: ClusterDraft,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(CLUSTER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage is best-effort only for this workflow.
  }
}
