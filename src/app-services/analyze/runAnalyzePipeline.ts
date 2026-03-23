import type { AnalyzeRequest } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import { ResolveIdentityCluster } from '@/src/contexts/identity-resolution/application/use-cases/ResolveIdentityCluster';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import { FetchIdentityClusterSnapshots } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import { AnalyzeIdentityCluster } from '@/src/contexts/portrait-analysis/application/use-cases/AnalyzeIdentityCluster';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';
import { analysisConfig } from '@/src/config/analysis';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';

type RunAnalyzePipelineContext = {
  traceId?: string;
  observability?: ObservabilityContext;
  narrativeModeOverride?: NarrativeMode;
};

export async function runAnalyzePipeline(input: AnalyzeRequest, ctx: RunAnalyzePipelineContext = {}) {
  const identityCluster = new ResolveIdentityCluster().execute(input.identity);
  const connectorRegistry = new StaticConnectorRegistry();
  const traceId = ctx.observability?.trace.traceId ?? ctx.traceId ?? crypto.randomUUID();
  const fetchResult = await new FetchIdentityClusterSnapshots(connectorRegistry).execute(
    {
      identityCluster,
      options: input.options,
    },
    {
      traceId,
      timeoutMs: platformPolicies.requestTimeoutMs,
      locale: input.options?.locale ?? 'zh-CN',
      observability: ctx.observability?.child('connector.fetch'),
    },
  );

  if (fetchResult.successfulCount === 0) {
    throw new Error('No account snapshots could be fetched for the requested identity cluster.');
  }

  const analysis = new AnalyzeIdentityCluster().execute({
    identityCluster,
    snapshots: fetchResult.successfulSnapshots.map((entry) => entry.snapshot),
    fetchResult,
    observability: ctx.observability?.child('cluster.analysis'),
  });

  const llmProvider = input.options?.llmProvider ?? analysisConfig.defaults.llmProvider;
  const narrativeMode =
    ctx.narrativeModeOverride ??
    (llmProvider === 'minimax' ? 'LLM_ASSISTED' : 'OFF');

  return new ComposePortraitReport().execute({
    ...analysis,
    narrative: {
      mode: narrativeMode,
    },
    observability: ctx.observability?.child('report.compose'),
  });
}
