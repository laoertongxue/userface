import type { AnalyzeRequest } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import { ResolveIdentityCluster } from '@/src/contexts/identity-resolution/application/use-cases/ResolveIdentityCluster';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import { FetchIdentityClusterSnapshots } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import { BuildCanonicalActivityStream } from '@/src/contexts/activity-normalization/application/use-cases/BuildCanonicalActivityStream';
import { AnalyzeIdentityCluster } from '@/src/contexts/portrait-analysis/application/use-cases/AnalyzeIdentityCluster';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';

export async function runAnalyzePipeline(input: AnalyzeRequest) {
  const identityCluster = new ResolveIdentityCluster().execute(input.identity);
  const connectorRegistry = new StaticConnectorRegistry();
  const snapshots = await new FetchIdentityClusterSnapshots(connectorRegistry).execute(
    {
      accounts: identityCluster.accounts,
      options: input.options,
    },
    {
      traceId: crypto.randomUUID(),
      timeoutMs: platformPolicies.requestTimeoutMs,
      locale: input.options?.locale ?? 'zh-CN',
    },
  );
  const activityStream = new BuildCanonicalActivityStream().execute(snapshots);
  const report = new AnalyzeIdentityCluster().execute({
    identityCluster,
    snapshots,
    activityStream,
  });

  return new ComposePortraitReport().execute(report);
}
