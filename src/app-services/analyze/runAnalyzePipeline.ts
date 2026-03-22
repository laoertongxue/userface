import type { AnalyzeRequest } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import { ResolveIdentityCluster } from '@/src/contexts/identity-resolution/application/use-cases/ResolveIdentityCluster';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import { FetchIdentityClusterSnapshots } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import { AnalyzeIdentityCluster } from '@/src/contexts/portrait-analysis/application/use-cases/AnalyzeIdentityCluster';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';

export async function runAnalyzePipeline(input: AnalyzeRequest) {
  const identityCluster = new ResolveIdentityCluster().execute(input.identity);
  const connectorRegistry = new StaticConnectorRegistry();
  const fetchResult = await new FetchIdentityClusterSnapshots(connectorRegistry).execute(
    {
      identityCluster,
      options: input.options,
    },
    {
      traceId: crypto.randomUUID(),
      timeoutMs: platformPolicies.requestTimeoutMs,
      locale: input.options?.locale ?? 'zh-CN',
    },
  );

  if (fetchResult.successfulCount === 0) {
    throw new Error('No account snapshots could be fetched for the requested identity cluster.');
  }

  const analysis = new AnalyzeIdentityCluster().execute({
    identityCluster,
    snapshots: fetchResult.successfulSnapshots.map((entry) => entry.snapshot),
    fetchResult,
  });

  return new ComposePortraitReport().execute(analysis);
}
