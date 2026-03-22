import { describe, expect, test } from 'vitest';
import { ResolveIdentityCluster } from '@/src/contexts/identity-resolution/application/use-cases/ResolveIdentityCluster';

describe('ResolveIdentityCluster', () => {
  test('keeps the single-account path compatible', () => {
    const cluster = new ResolveIdentityCluster().execute({
      accounts: [
        {
          community: 'v2ex',
          handle: ' alpha ',
        },
      ],
    });

    expect(cluster.mode).toBe('SINGLE_ACCOUNT');
    expect(cluster.accounts).toEqual([
      expect.objectContaining({
        community: 'v2ex',
        handle: 'alpha',
      }),
    ]);
    expect(cluster.links).toEqual([]);
  });

  test('builds a manual cluster and user-asserted links for multi-account input', () => {
    const cluster = new ResolveIdentityCluster().execute({
      label: 'dual-community',
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
    });

    expect(cluster.mode).toBe('MANUAL_CLUSTER');
    expect(cluster.accounts).toHaveLength(2);
    expect(cluster.links).toEqual([
      expect.objectContaining({
        source: 'USER_ASSERTED',
        confidence: 1,
      }),
    ]);
    expect(cluster.label).toBe('dual-community');
  });

  test('dedupes duplicate accounts before producing the aggregate', () => {
    const cluster = new ResolveIdentityCluster().execute({
      accounts: [
        {
          community: 'v2ex',
          handle: 'alpha',
        },
        {
          community: 'v2ex',
          handle: ' Alpha ',
        },
      ],
    });

    expect(cluster.accounts).toHaveLength(1);
    expect(cluster.mode).toBe('SINGLE_ACCOUNT');
  });
});
