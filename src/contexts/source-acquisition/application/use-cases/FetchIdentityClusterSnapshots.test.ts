import { describe, expect, test, vi } from 'vitest';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import { FetchIdentityClusterSnapshots } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import type {
  AcquisitionContext,
  ConnectorSnapshot,
  ConnectorWarning,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import { AcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import {
  createTestObservabilityContext,
  MemoryObservabilitySink,
} from '@/src/contexts/platform-governance/__tests__/observabilityTestHelpers';

function buildSnapshot(
  ref: ExternalAccountRef,
  overrides: Partial<ConnectorSnapshot> = {},
): ConnectorSnapshot {
  return {
    ref,
    profile: {
      community: ref.community,
      handle: ref.handle,
      displayName: ref.handle,
      stats: {},
    },
    activities: [],
    diagnostics: {
      fetchedPages: 1,
      fetchedItems: 0,
      elapsedMs: 10,
      degraded: false,
      usedRoutes: ['/member/:id'],
    },
    warnings: [],
    ...overrides,
  };
}

class FakeConnector implements CommunityConnector {
  readonly mode = 'public' as const;
  readonly capabilities = {
    publicProfile: true,
    publicTopics: true,
    publicReplies: true,
    requiresAuth: false,
    supportsPagination: true,
    supportsCrossCommunityHints: false,
  };

  constructor(
    readonly community: 'v2ex' | 'guozaoke' | 'weibo',
    private readonly resolver: (input: FetchSnapshotInput) => Promise<ConnectorSnapshot>,
  ) {}

  async probe(ref: ExternalAccountRef, _ctx: AcquisitionContext) {
    return {
      ok: true,
      community: ref.community,
      ref,
      warnings: [],
    };
  }

  fetchSnapshot(input: FetchSnapshotInput, _ctx: AcquisitionContext): Promise<ConnectorSnapshot> {
    return this.resolver(input);
  }
}

class FakeRegistry implements ConnectorRegistry {
  constructor(private readonly connectors: Record<string, CommunityConnector>) {}

  get(community: 'v2ex' | 'guozaoke' | 'weibo'): CommunityConnector {
    return this.connectors[community];
  }

  list(): CommunityConnector[] {
    return Object.values(this.connectors);
  }
}

const acquisitionContext: AcquisitionContext = {
  traceId: 'test-trace',
  timeoutMs: 1000,
  locale: 'zh-CN',
};

describe('FetchIdentityClusterSnapshots', () => {
  test('fetches multiple same-community accounts and preserves input order', async () => {
    const cluster = createIdentityCluster({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'v2ex', handle: 'beta' },
      ],
      links: [
        {
          from: { community: 'v2ex', handle: 'alpha' },
          to: { community: 'v2ex', handle: 'beta' },
          source: 'USER_ASSERTED',
        },
      ],
      mode: 'MANUAL_CLUSTER',
      now: '2026-03-22T00:00:00.000Z',
    });

    const registry = new FakeRegistry({
      v2ex: new FakeConnector('v2ex', async ({ ref }) =>
        buildSnapshot(ref, {
          activities: [
            {
              id: `${ref.handle}-1`,
              community: 'v2ex',
              handle: ref.handle,
              type: 'reply',
              url: `https://www.v2ex.com/t/${ref.handle}`,
              contentText: `Reply from ${ref.handle}`,
              excerpt: `Reply from ${ref.handle}`,
              publishedAt: '2026-03-22T00:00:00.000Z',
              sourceTrace: {
                route: '/member/:username/replies',
                fetchedAt: '2026-03-22T00:00:01.000Z',
                contentHash: `hash-${ref.handle}`,
              },
            },
          ],
          diagnostics: {
            fetchedPages: 2,
            fetchedItems: 1,
            elapsedMs: 10,
            degraded: false,
            usedRoutes: ['/api/members/show.json', '/member/:username/replies'],
          },
        }),
      ),
      guozaoke: new FakeConnector('guozaoke', async ({ ref }) => buildSnapshot(ref)),
      weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    });

    const result = await new FetchIdentityClusterSnapshots(registry).execute(
      {
        identityCluster: cluster,
      },
      acquisitionContext,
    );

    expect(result.successfulCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.successfulSnapshots.map((entry) => entry.account.handle)).toEqual(['alpha', 'beta']);
  });

  test('dedupes duplicate accounts and only fetches once', async () => {
    const cluster = createIdentityCluster({
      accounts: [{ community: 'v2ex', handle: 'alpha' }],
      mode: 'SINGLE_ACCOUNT',
      now: '2026-03-22T00:00:00.000Z',
    });
    const fetchSpy = vi.fn(async ({ ref }: FetchSnapshotInput) => buildSnapshot(ref));
    const registry = new FakeRegistry({
      v2ex: new FakeConnector('v2ex', fetchSpy),
      guozaoke: new FakeConnector('guozaoke', async ({ ref }) => buildSnapshot(ref)),
      weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    });

    const result = await new FetchIdentityClusterSnapshots(registry).execute(
      {
        identityCluster: {
          ...cluster,
          accounts: [
            { community: 'v2ex', handle: 'alpha' },
            { community: 'v2ex', handle: ' Alpha ' },
          ],
          mode: 'MANUAL_CLUSTER',
        },
      },
      acquisitionContext,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.totalAccounts).toBe(1);
    expect(result.successfulCount).toBe(1);
  });

  test('keeps partial success when one account fails', async () => {
    const cluster = createIdentityCluster({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'beta' },
      ],
      links: [
        {
          from: { community: 'v2ex', handle: 'alpha' },
          to: { community: 'guozaoke', handle: 'beta' },
          source: 'USER_ASSERTED',
        },
      ],
      mode: 'MANUAL_CLUSTER',
      now: '2026-03-22T00:00:00.000Z',
    });

    const registry = new FakeRegistry({
      v2ex: new FakeConnector('v2ex', async ({ ref }) => buildSnapshot(ref)),
      guozaoke: new FakeConnector('guozaoke', async () => {
        throw AcquisitionError.fromStatus(429, 'https://www.guozaoke.com/u/beta');
      }),
      weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    });

    const result = await new FetchIdentityClusterSnapshots(registry).execute(
      {
        identityCluster: cluster,
      },
      acquisitionContext,
    );

    expect(result.successfulCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.degraded).toBe(true);
    expect(result.failedAccounts).toEqual([
      expect.objectContaining({
        account: expect.objectContaining({ handle: 'beta' }),
        code: 'RATE_LIMITED',
      }),
    ]);
  });

  test('records connector fetch and cluster partial-success observability events without changing behavior', async () => {
    const cluster = createIdentityCluster({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'beta' },
      ],
      links: [
        {
          from: { community: 'v2ex', handle: 'alpha' },
          to: { community: 'guozaoke', handle: 'beta' },
          source: 'USER_ASSERTED',
        },
      ],
      mode: 'MANUAL_CLUSTER',
      now: '2026-03-22T00:00:00.000Z',
    });
    const sink = new MemoryObservabilitySink();

    const registry = new FakeRegistry({
      v2ex: new FakeConnector('v2ex', async ({ ref }) => buildSnapshot(ref)),
      guozaoke: new FakeConnector('guozaoke', async () => {
        throw AcquisitionError.fromStatus(429, 'https://www.guozaoke.com/u/beta');
      }),
      weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    });

    const result = await new FetchIdentityClusterSnapshots(registry).execute(
      {
        identityCluster: cluster,
      },
      {
        ...acquisitionContext,
        observability: createTestObservabilityContext(sink, {
          route: '/api/analyze',
          operation: 'connector.fetch',
        }),
      },
    );

    expect(result.successfulCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(sink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'connector.fetch.started' }),
        expect.objectContaining({ event: 'connector.fetch.completed' }),
        expect.objectContaining({ event: 'connector.fetch.failed' }),
        expect.objectContaining({
          event: 'cluster.analysis.partial_success',
          errorCode: 'CLUSTER_PARTIAL_SUCCESS',
        }),
      ]),
    );
    expect(sink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'connector.fetch_total' }),
        expect.objectContaining({ name: 'cluster.partial_success_total' }),
      ]),
    );
  });

  test('returns explicit all-failed state without throwing', async () => {
    const cluster = createIdentityCluster({
      accounts: [
        { community: 'v2ex', handle: 'alpha' },
        { community: 'guozaoke', handle: 'beta' },
      ],
      links: [
        {
          from: { community: 'v2ex', handle: 'alpha' },
          to: { community: 'guozaoke', handle: 'beta' },
          source: 'USER_ASSERTED',
        },
      ],
      mode: 'MANUAL_CLUSTER',
      now: '2026-03-22T00:00:00.000Z',
    });

    const registry = new FakeRegistry({
      v2ex: new FakeConnector('v2ex', async ({ ref }) =>
        buildSnapshot(ref, {
          profile: null,
          warnings: [
            {
              code: 'NOT_FOUND',
              message: 'V2EX member "alpha" was not found.',
            } satisfies ConnectorWarning,
          ],
          diagnostics: {
            fetchedPages: 0,
            fetchedItems: 0,
            elapsedMs: 10,
            degraded: true,
            usedRoutes: ['/api/members/show.json'],
          },
        }),
      ),
      guozaoke: new FakeConnector('guozaoke', async () => {
        throw AcquisitionError.network('https://www.guozaoke.com/u/beta');
      }),
      weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
    });

    const result = await new FetchIdentityClusterSnapshots(registry).execute(
      {
        identityCluster: cluster,
      },
      acquisitionContext,
    );

    expect(result.successfulCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(result.degraded).toBe(true);
    expect(result.failedAccounts.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['NOT_FOUND', 'PARTIAL_RESULT']),
    );
  });
});
