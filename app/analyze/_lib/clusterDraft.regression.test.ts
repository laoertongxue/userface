import { describe, expect, test } from 'vitest';
import {
  buildAnalyzeRequest,
  buildSuggestRequest,
  createDefaultClusterDraft,
  pairKeyForAccounts,
  readClusterDraft,
  writeClusterDraft,
  upsertSuggestionDecision,
  CLUSTER_DRAFT_STORAGE_KEY,
} from '@/app/analyze/_lib/clusterDraft';

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('cluster draft workflow regression', () => {
  test('draft persistence survives a localStorage round trip and falls back cleanly when storage is unavailable', () => {
    const storage = createMemoryStorage();
    const draft = {
      ...createDefaultClusterDraft(),
      mode: 'MANUAL_CLUSTER' as const,
      accounts: [
        { community: 'v2ex' as const, handle: 'alpha' },
        { community: 'guozaoke' as const, handle: 'beta' },
      ],
      suggestionDecisions: [
        {
          pairKey: 'guozaoke:beta|v2ex:alpha',
          status: 'ACCEPTED' as const,
        },
      ],
      lastSuggestedAt: '2026-03-22T10:00:00.000Z',
    };

    writeClusterDraft(storage, draft);

    expect(storage.getItem(CLUSTER_DRAFT_STORAGE_KEY)).toContain('"MANUAL_CLUSTER"');
    expect(readClusterDraft(storage)).toEqual(draft);
    expect(readClusterDraft(null)).toEqual(createDefaultClusterDraft());
  });

  test('manual-cluster analyze requests stay deduped while suggestion decisions remain local-only metadata', () => {
    const pairKey = pairKeyForAccounts([
      { community: 'v2ex', handle: 'alpha' },
      { community: 'guozaoke', handle: 'beta' },
    ]);
    const decisions = upsertSuggestionDecision([], pairKey, 'ACCEPTED');

    expect(decisions).toEqual([{ pairKey, status: 'ACCEPTED' }]);
    expect(
      buildAnalyzeRequest('MANUAL_CLUSTER', [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'v2ex', handle: ' Alpha ' },
        { community: 'guozaoke', handle: 'beta' },
      ]),
    ).toEqual({
      identity: {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });
  });

  test('suggestion-assisted workflow keeps suggest and analyze request contracts separate', () => {
    const accounts = [
      { community: 'v2ex' as const, handle: 'alpha' },
      { community: 'guozaoke' as const, handle: 'beta' },
    ];

    expect(buildSuggestRequest(accounts)).toEqual({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'beta' },
      ],
      maxSuggestions: 10,
    });
    expect(buildAnalyzeRequest('MANUAL_CLUSTER', accounts)).toEqual({
      identity: {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });
  });
});
