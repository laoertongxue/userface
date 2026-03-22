import { describe, expect, test } from 'vitest';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import type {
  AcquisitionContext,
  ConnectorProbeResult,
  ConnectorSnapshot,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { SuggestIdentityLinks } from '@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks';

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

  async probe(ref: ExternalAccountRef, _ctx: AcquisitionContext): Promise<ConnectorProbeResult> {
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
  traceId: 'suggest-test',
  timeoutMs: 1000,
  locale: 'zh-CN',
};

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
      usedRoutes: ['/profile'],
    },
    warnings: [],
    ...overrides,
  };
}

describe('SuggestIdentityLinks', () => {
  test('fetches profile hints and returns suggestions without creating cluster facts', async () => {
    const useCase = new SuggestIdentityLinks(
      new FakeRegistry({
        v2ex: new FakeConnector('v2ex', async ({ ref }) =>
          buildSnapshot(ref, {
            profile: {
              community: 'v2ex',
              handle: ref.handle,
              displayName: 'Alpha',
              homepageUrl: 'https://example.com/about',
              stats: {},
            },
          }),
        ),
        guozaoke: new FakeConnector('guozaoke', async ({ ref }) =>
          buildSnapshot(ref, {
            profile: {
              community: 'guozaoke',
              handle: ref.handle,
              displayName: 'Alpha',
              homepageUrl: 'https://example.com/about/',
              stats: {},
            },
          }),
        ),
        weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
      }),
    );

    const result = await useCase.execute(
      {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'alpha' },
        ],
      },
      acquisitionContext,
    );

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].status).toBe('PENDING');
    expect(result.inspectedAccounts).toHaveLength(2);
    expect(result).not.toHaveProperty('cluster');
    expect(result).not.toHaveProperty('links');
  });

  test('returns warnings and no suggestions when no profile hints are available', async () => {
    const useCase = new SuggestIdentityLinks(
      new FakeRegistry({
        v2ex: new FakeConnector('v2ex', async () => {
          throw new Error('profile fetch failed');
        }),
        guozaoke: new FakeConnector('guozaoke', async () => {
          throw new Error('profile fetch failed');
        }),
        weibo: new FakeConnector('weibo', async ({ ref }) => buildSnapshot(ref)),
      }),
    );

    const result = await useCase.execute(
      {
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'alpha' },
        ],
      },
      acquisitionContext,
    );

    expect(result.suggestions).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NO_PROFILE_HINTS_AVAILABLE' }),
      ]),
    );
  });
});
