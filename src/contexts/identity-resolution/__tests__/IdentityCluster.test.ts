import { describe, expect, test } from 'vitest';
import {
  createIdentityCluster,
  clusterAccountKey,
} from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import { accountLinkSourceValues } from '@/src/contexts/identity-resolution/domain/value-objects/AccountLinkSource';
import { clusterAnalysisModeValues } from '@/src/contexts/identity-resolution/domain/value-objects/ClusterAnalysisMode';
import { clusterAnalysisScopeValues } from '@/src/contexts/identity-resolution/domain/value-objects/ClusterAnalysisScope';
import {
  mergeSuggestionStatusValues,
  type MergeSuggestion,
} from '@/src/contexts/identity-resolution/domain/entities/MergeSuggestion';
import type { ClusterAnalysisInput } from '@/src/contexts/identity-resolution/application/dto/ClusterAnalysisInput';

describe('IdentityCluster contract', () => {
  test('allows a single-account cluster', () => {
    const cluster = createIdentityCluster({
      accounts: [
        {
          community: 'v2ex',
          handle: 'alpha',
        },
      ],
      mode: 'SINGLE_ACCOUNT',
      now: '2026-03-22T00:00:00.000Z',
    });

    expect(cluster.mode).toBe('SINGLE_ACCOUNT');
    expect(cluster.accounts).toHaveLength(1);
    expect(cluster.links).toEqual([]);
    expect(cluster.primaryAccountRef).toMatchObject({
      community: 'v2ex',
      handle: 'alpha',
    });
  });

  test('allows a manual multi-account cluster with explicit links', () => {
    const cluster = createIdentityCluster({
      label: 'cross-community-subject',
      accounts: [
        {
          community: 'v2ex',
          handle: 'alpha',
        },
        {
          community: 'guozaoke',
          handle: 'alpha',
        },
      ],
      links: [
        {
          from: {
            community: 'v2ex',
            handle: 'alpha',
          },
          to: {
            community: 'guozaoke',
            handle: 'alpha',
          },
          source: 'USER_ASSERTED',
          rationale: 'Submitted together by the operator.',
        },
      ],
      mode: 'MANUAL_CLUSTER',
      now: '2026-03-22T00:00:00.000Z',
    });

    expect(cluster.mode).toBe('MANUAL_CLUSTER');
    expect(cluster.accounts).toHaveLength(2);
    expect(cluster.links).toEqual([
      expect.objectContaining({
        source: 'USER_ASSERTED',
      }),
    ]);
    expect(cluster.id).toBeTypeOf('string');
  });

  test('rejects duplicate community + handle accounts inside the aggregate', () => {
    expect(() =>
      createIdentityCluster({
        accounts: [
          {
            community: 'v2ex',
            handle: 'alpha',
          },
          {
            community: 'v2ex',
            handle: ' alpha ',
          },
        ],
        mode: 'MANUAL_CLUSTER',
      }),
    ).toThrow('IdentityCluster accounts must be unique');
  });

  test('exposes stable enums and input contract helpers', () => {
    expect(accountLinkSourceValues).toEqual(
      expect.arrayContaining(['MANUAL_CONFIRMED', 'USER_ASSERTED', 'SUGGESTED']),
    );
    expect(clusterAnalysisModeValues).toEqual(
      expect.arrayContaining(['SINGLE_ACCOUNT', 'MANUAL_CLUSTER']),
    );
    expect(clusterAnalysisScopeValues).toEqual(
      expect.arrayContaining(['PER_ACCOUNT_ONLY', 'AGGREGATED_ONLY', 'AGGREGATED_WITH_BREAKDOWN']),
    );
    expect(mergeSuggestionStatusValues).toEqual(
      expect.arrayContaining(['PENDING', 'ACCEPTED', 'REJECTED']),
    );

    const suggestion: MergeSuggestion = {
      candidateAccounts: [
        {
          community: 'v2ex',
          handle: 'alpha',
        },
        {
          community: 'guozaoke',
          handle: 'alpha',
        },
      ],
      confidence: 0.72,
      reasons: ['exact-handle-match'],
      status: 'PENDING',
    };
    const clusterInput: ClusterAnalysisInput = {
      cluster: createIdentityCluster({
        accounts: suggestion.candidateAccounts,
        links: [
          {
            from: suggestion.candidateAccounts[0],
            to: suggestion.candidateAccounts[1],
            source: 'USER_ASSERTED',
          },
        ],
        mode: 'MANUAL_CLUSTER',
        now: '2026-03-22T00:00:00.000Z',
      }),
      scope: 'AGGREGATED_WITH_BREAKDOWN',
    };

    expect(clusterInput.scope).toBe('AGGREGATED_WITH_BREAKDOWN');
    expect(clusterAccountKey(clusterInput.cluster.accounts[0])).toBe('v2ex:alpha');
  });
});
