import type { AnalyzeRequest } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import type {
  ConnectorSnapshot,
  ConnectorWarning,
  ExternalAccountRef,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { AcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';

type SnapshotPlan =
  | {
      kind: 'success';
      snapshot: ConnectorSnapshot;
    }
  | {
      kind: 'error';
      error: Error;
    };

export type ClusterWorkflowGoldenCaseId =
  | 'single-account-compatible'
  | 'dual-account-same-community'
  | 'dual-account-cross-community'
  | 'duplicate-account-input'
  | 'partial-success-cluster'
  | 'all-failed-cluster';

export type ClusterWorkflowGoldenCase = {
  id: ClusterWorkflowGoldenCaseId;
  purpose: string;
  request: AnalyzeRequest;
  plans: Record<string, SnapshotPlan>;
  expectations: {
    shouldSucceed: boolean;
    activeCommunities?: string[];
    degraded?: boolean;
    failedCount?: number;
    requestedCount?: number;
    stableTraits?: 'minimal' | 'present' | 'absent';
    communitySpecificTraitCommunities?: string[];
    overlap?: 'empty' | 'present';
    divergence?: 'empty' | 'present';
  };
};

function accountKey(account: { community: string; handle: string }): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

function buildLongText(seed: string): string {
  return `${seed} This activity includes enough detail to act as stable portrait evidence across the regression baseline. It explains intent, context, and tradeoffs without relying on platform-specific parsing details.`;
}

function buildActivity(
  ref: ExternalAccountRef,
  index: number,
  overrides: Partial<ConnectorSnapshot['activities'][number]> = {},
): ConnectorSnapshot['activities'][number] {
  const type = overrides.type ?? 'reply';
  const suffix = type === 'topic' ? 'topic' : 'reply';

  return {
    id: `${ref.community}-${ref.handle}-${suffix}-${index}`,
    community: ref.community,
    handle: ref.handle,
    type,
    url: overrides.url ?? `https://example.com/${ref.community}/${ref.handle}/${suffix}/${index}`,
    topicTitle: overrides.topicTitle ?? `${ref.handle} ${suffix} ${index}`,
    nodeName: overrides.nodeName,
    contentText: overrides.contentText ?? buildLongText(`${ref.handle} ${suffix} ${index}.`),
    excerpt: overrides.excerpt ?? buildLongText(`${ref.handle} ${suffix} ${index}.`),
    publishedAt:
      overrides.publishedAt ??
      `2026-03-${String(10 + index).padStart(2, '0')}T00:00:00.000Z`,
    sourceTrace: overrides.sourceTrace ?? {
      route: `/${ref.community}/:handle/${suffix}`,
      fetchedAt: '2026-03-22T00:05:00.000Z',
      contentHash: `${ref.community}-${ref.handle}-${suffix}-${index}`,
    },
  };
}

function buildSnapshot(
  ref: ExternalAccountRef,
  activities: ConnectorSnapshot['activities'],
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
    activities,
    diagnostics: {
      fetchedPages: Math.max(1, Math.ceil(activities.length / 4)),
      fetchedItems: activities.length,
      elapsedMs: 20,
      degraded: false,
      usedRoutes: ['/profile', '/activities'],
    },
    warnings: [],
    ...overrides,
  };
}

function buildReplySeries(
  ref: ExternalAccountRef,
  days: string[],
  nodeName = 'architecture',
): ConnectorSnapshot['activities'] {
  return days.map((day, index) =>
    buildActivity(ref, index + 1, {
      type: 'reply',
      topicTitle: `${ref.handle} reply topic ${index + 1}`,
      nodeName,
      contentText:
        index % 2 === 0
          ? buildLongText(`${ref.handle} reply ${index + 1}?`)
          : buildLongText(`${ref.handle} reply ${index + 1}.`),
      excerpt:
        index % 2 === 0
          ? buildLongText(`${ref.handle} reply ${index + 1}?`)
          : buildLongText(`${ref.handle} reply ${index + 1}.`),
      publishedAt: `${day}T00:00:00.000Z`,
      sourceTrace: {
        route: '/member/:username/replies',
        fetchedAt: '2026-03-22T00:05:00.000Z',
        contentHash: `${ref.community}-${ref.handle}-reply-${index + 1}`,
      },
    }),
  );
}

function buildTopicSeries(
  ref: ExternalAccountRef,
  days: string[],
  nodes: string[],
): ConnectorSnapshot['activities'] {
  return days.map((day, index) =>
    buildActivity(ref, index + 1, {
      type: 'topic',
      topicTitle: `${ref.handle} topic ${index + 1}`,
      nodeName: nodes[index % nodes.length],
      contentText:
        index % 2 === 0
          ? buildLongText(`${ref.handle} topic ${index + 1} includes www.example.com for context.`)
          : buildLongText(`${ref.handle} topic ${index + 1} explores a focused node in detail.`),
      excerpt:
        index % 2 === 0
          ? buildLongText(`${ref.handle} topic ${index + 1} includes www.example.com for context.`)
          : buildLongText(`${ref.handle} topic ${index + 1} explores a focused node in detail.`),
      publishedAt: `${day}T00:00:00.000Z`,
      sourceTrace: {
        route: '/u/:id/topics',
        fetchedAt: '2026-03-22T00:05:00.000Z',
        contentHash: `${ref.community}-${ref.handle}-topic-${index + 1}`,
      },
    }),
  );
}

function buildRequest(accounts: AnalyzeRequest['identity']['accounts']): AnalyzeRequest {
  return {
    identity: {
      accounts,
    },
    options: {
      locale: 'zh-CN',
    },
  };
}

const singleAccountRef: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'solo-user',
};
const sameCommunityAlpha: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'alpha',
};
const sameCommunityBeta: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'beta',
};
const crossV2ex: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'cross-alpha',
};
const crossGuozaoke: ExternalAccountRef = {
  community: 'guozaoke',
  handle: 'cross-beta',
};
const duplicateRef: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'duplicate-user',
};
const partialSuccessRef: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'partial-alpha',
};
const partialFailureRef: ExternalAccountRef = {
  community: 'guozaoke',
  handle: 'partial-beta',
};
const failedV2exRef: ExternalAccountRef = {
  community: 'v2ex',
  handle: 'missing-alpha',
};
const failedGuozaokeRef: ExternalAccountRef = {
  community: 'guozaoke',
  handle: 'missing-beta',
};

const notFoundWarning: ConnectorWarning = {
  code: 'NOT_FOUND',
  message: 'Requested account was not found.',
};

export const CLUSTER_WORKFLOW_GOLDEN_CASES: ClusterWorkflowGoldenCase[] = [
  {
    id: 'single-account-compatible',
    purpose: 'Keep the cluster-aware pipeline compatible with the legacy single-account flow.',
    request: buildRequest([{ community: 'v2ex', handle: 'solo-user' }]),
    plans: {
      [accountKey(singleAccountRef)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          singleAccountRef,
          buildReplySeries(singleAccountRef, ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17']),
        ),
      },
    },
    expectations: {
      shouldSucceed: true,
      activeCommunities: ['v2ex'],
      degraded: false,
      requestedCount: 1,
      failedCount: 0,
      stableTraits: 'minimal',
      overlap: 'empty',
      divergence: 'empty',
    },
  },
  {
    id: 'dual-account-same-community',
    purpose: 'Verify same-community multi-account orchestration, merge, and account coverage remain stable.',
    request: buildRequest([
      { community: 'v2ex', handle: 'alpha' },
      { community: 'v2ex', handle: 'beta' },
    ]),
    plans: {
      [accountKey(sameCommunityAlpha)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          sameCommunityAlpha,
          buildReplySeries(sameCommunityAlpha, ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']),
        ),
      },
      [accountKey(sameCommunityBeta)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          sameCommunityBeta,
          buildTopicSeries(sameCommunityBeta, ['2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17'], [
            'frontend',
            'product',
            'architecture',
            'tooling',
          ]),
        ),
      },
    },
    expectations: {
      shouldSucceed: true,
      activeCommunities: ['v2ex'],
      degraded: false,
      requestedCount: 2,
      failedCount: 0,
      stableTraits: 'present',
      overlap: 'empty',
      divergence: 'empty',
    },
  },
  {
    id: 'dual-account-cross-community',
    purpose: 'Exercise the full aggregated report path across v2ex and guozaoke with stable and community-specific traits.',
    request: buildRequest([
      { community: 'v2ex', handle: 'cross-alpha' },
      { community: 'guozaoke', handle: 'cross-beta' },
    ]),
    plans: {
      [accountKey(crossV2ex)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          crossV2ex,
          buildReplySeries(crossV2ex, ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'], 'architecture'),
        ),
      },
      [accountKey(crossGuozaoke)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          crossGuozaoke,
          buildTopicSeries(crossGuozaoke, ['2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17'], [
            'build',
            'curation',
            'notes',
            'tools',
          ]),
        ),
      },
    },
    expectations: {
      shouldSucceed: true,
      activeCommunities: ['guozaoke', 'v2ex'],
      degraded: false,
      requestedCount: 2,
      failedCount: 0,
      stableTraits: 'present',
      communitySpecificTraitCommunities: ['guozaoke', 'v2ex'],
      overlap: 'present',
      divergence: 'present',
    },
  },
  {
    id: 'duplicate-account-input',
    purpose: 'Ensure duplicate community + handle input does not inflate fetches, metrics, or coverage.',
    request: buildRequest([
      { community: 'v2ex', handle: 'duplicate-user' },
      { community: 'v2ex', handle: ' duplicate-user ' },
    ]),
    plans: {
      [accountKey(duplicateRef)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          duplicateRef,
          buildReplySeries(duplicateRef, ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17']),
        ),
      },
    },
    expectations: {
      shouldSucceed: true,
      activeCommunities: ['v2ex'],
      degraded: false,
      requestedCount: 1,
      failedCount: 0,
      stableTraits: 'minimal',
      overlap: 'empty',
      divergence: 'empty',
    },
  },
  {
    id: 'partial-success-cluster',
    purpose: 'Keep partial-success cluster analysis available when at least one account succeeds.',
    request: buildRequest([
      { community: 'v2ex', handle: 'partial-alpha' },
      { community: 'guozaoke', handle: 'partial-beta' },
    ]),
    plans: {
      [accountKey(partialSuccessRef)]: {
        kind: 'success',
        snapshot: buildSnapshot(
          partialSuccessRef,
          buildReplySeries(partialSuccessRef, ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17']),
        ),
      },
      [accountKey(partialFailureRef)]: {
        kind: 'error',
        error: AcquisitionError.fromStatus(
          429,
          'https://www.guozaoke.com/u/partial-beta',
        ),
      },
    },
    expectations: {
      shouldSucceed: true,
      activeCommunities: ['v2ex'],
      degraded: true,
      requestedCount: 2,
      failedCount: 1,
      stableTraits: 'minimal',
      overlap: 'empty',
      divergence: 'empty',
    },
  },
  {
    id: 'all-failed-cluster',
    purpose: 'Keep the failure boundary explicit when no account snapshot can be fetched.',
    request: buildRequest([
      { community: 'v2ex', handle: 'missing-alpha' },
      { community: 'guozaoke', handle: 'missing-beta' },
    ]),
    plans: {
      [accountKey(failedV2exRef)]: {
        kind: 'success',
        snapshot: buildSnapshot(failedV2exRef, [], {
          profile: null,
          warnings: [notFoundWarning],
          diagnostics: {
            fetchedPages: 0,
            fetchedItems: 0,
            elapsedMs: 10,
            degraded: true,
            usedRoutes: ['/api/members/show.json'],
          },
        }),
      },
      [accountKey(failedGuozaokeRef)]: {
        kind: 'error',
        error: AcquisitionError.network('https://www.guozaoke.com/u/missing-beta'),
      },
    },
    expectations: {
      shouldSucceed: false,
      degraded: true,
      requestedCount: 2,
      failedCount: 2,
      stableTraits: 'absent',
      overlap: 'empty',
      divergence: 'empty',
    },
  },
];

export function getClusterWorkflowGoldenCase(
  id: ClusterWorkflowGoldenCaseId,
): ClusterWorkflowGoldenCase {
  const found = CLUSTER_WORKFLOW_GOLDEN_CASES.find((goldenCase) => goldenCase.id === id);

  if (!found) {
    throw new Error(`Unknown Stage 4 cluster workflow golden case: ${id}`);
  }

  return found;
}

