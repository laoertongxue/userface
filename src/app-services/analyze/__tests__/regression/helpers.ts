import { vi } from 'vitest';
import type { AnalyzeRequest } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type {
  AcquisitionContext,
  ConnectorProbeResult,
  ConnectorSnapshot,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { ClusterWorkflowGoldenCase } from '@/src/app-services/analyze/__tests__/regression/clusterWorkflow.goldenCases';

type SnapshotPlan = ClusterWorkflowGoldenCase['plans'][string];

type GoldenCaseExecutionResult = {
  error?: Error;
  fetchCalls: string[];
  report?: Awaited<ReturnType<typeof import('@/src/app-services/analyze/runAnalyzePipeline').runAnalyzePipeline>>;
};

function accountKey(account: { community: string; handle: string }): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

class RegressionConnector implements CommunityConnector {
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

function createConnectorMap(
  plans: ClusterWorkflowGoldenCase['plans'],
  fetchCalls: string[],
): Record<'v2ex' | 'guozaoke' | 'weibo', CommunityConnector> {
  const resolvePlan = async ({ ref }: FetchSnapshotInput) => {
    const key = accountKey(ref);
    fetchCalls.push(key);
    const plan: SnapshotPlan | undefined = plans[key];

    if (!plan) {
      throw new Error(`No regression snapshot plan configured for ${key}.`);
    }

    if (plan.kind === 'error') {
      throw plan.error;
    }

    return plan.snapshot;
  };

  return {
    v2ex: new RegressionConnector('v2ex', resolvePlan),
    guozaoke: new RegressionConnector('guozaoke', resolvePlan),
    weibo: new RegressionConnector('weibo', resolvePlan),
  };
}

export async function runClusterWorkflowGoldenCase(
  goldenCase: ClusterWorkflowGoldenCase,
): Promise<GoldenCaseExecutionResult> {
  vi.resetModules();
  const fetchCalls: string[] = [];
  const connectors = createConnectorMap(goldenCase.plans, fetchCalls);

  vi.doMock('@/src/contexts/source-acquisition/infrastructure/connectors/registry', () => ({
    StaticConnectorRegistry: class StaticConnectorRegistry {
      get(community: 'v2ex' | 'guozaoke' | 'weibo') {
        return connectors[community];
      }

      list() {
        return Object.values(connectors);
      }
    },
  }));

  try {
    const { runAnalyzePipeline } = await import('@/src/app-services/analyze/runAnalyzePipeline');
    const report = await runAnalyzePipeline(goldenCase.request as AnalyzeRequest);

    return {
      fetchCalls,
      report,
    };
  } catch (error) {
    return {
      fetchCalls,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    vi.doUnmock('@/src/contexts/source-acquisition/infrastructure/connectors/registry');
  }
}

