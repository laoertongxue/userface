import { describe, expect, test } from 'vitest';
import {
  buildAnalyzeRequest,
  buildSuggestRequest,
  dedupeDraftAccounts,
  pairKeyForAccounts,
  upsertSuggestionDecision,
} from '@/app/analyze/_lib/clusterDraft';

describe('clusterDraft helpers', () => {
  test('dedupeDraftAccounts removes repeated community + handle pairs', () => {
    expect(
      dedupeDraftAccounts([
        { community: 'v2ex', handle: ' Alpha ' },
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'alpha' },
      ]),
    ).toEqual([
      { community: 'v2ex', handle: 'Alpha' },
      { community: 'guozaoke', handle: 'alpha' },
    ]);
  });

  test('buildAnalyzeRequest keeps single-account and manual-cluster request shapes stable', () => {
    expect(
      buildAnalyzeRequest('SINGLE_ACCOUNT', [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'beta' },
      ]),
    ).toEqual({
      identity: {
        accounts: [{ community: 'v2ex', handle: 'alpha' }],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(
      buildAnalyzeRequest('MANUAL_CLUSTER', [
        { community: 'v2ex', handle: 'alpha' },
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

  test('upsertSuggestionDecision only changes local decision state', () => {
    const pairKey = pairKeyForAccounts([
      { community: 'v2ex', handle: 'alpha' },
      { community: 'guozaoke', handle: 'alpha' },
    ]);
    const updated = upsertSuggestionDecision([], pairKey, 'ACCEPTED');

    expect(updated).toEqual([{ pairKey, status: 'ACCEPTED' }]);
    expect(buildSuggestRequest([
      { community: 'v2ex', handle: 'alpha' },
      { community: 'guozaoke', handle: 'alpha' },
    ])).toEqual({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'alpha' },
      ],
      maxSuggestions: 10,
    });
  });
});
