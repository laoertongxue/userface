import { NextResponse } from 'next/server';
import { ResolveIdentityCluster } from '@/src/contexts/identity-resolution/application/use-cases/ResolveIdentityCluster';
import { FetchIdentityClusterSnapshots } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import { BuildCanonicalActivityStream } from '@/src/contexts/activity-normalization/application/use-cases/BuildCanonicalActivityStream';
import { AnalyzeIdentityCluster } from '@/src/contexts/portrait-analysis/application/use-cases/AnalyzeIdentityCluster';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { analyzeRequestSchema } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = analyzeRequestSchema.parse(body);
    const identityCluster = new ResolveIdentityCluster().execute(parsed.identity);
    const connectorRegistry = new StaticConnectorRegistry();
    const snapshots = await new FetchIdentityClusterSnapshots(connectorRegistry).execute(
      {
        accounts: identityCluster.accounts,
        options: parsed.options,
      },
      {
        traceId: crypto.randomUUID(),
        timeoutMs: platformPolicies.requestTimeoutMs,
        locale: parsed.options?.locale ?? 'zh-CN',
      },
    );
    const activityStream = new BuildCanonicalActivityStream().execute(snapshots);
    const report = new AnalyzeIdentityCluster().execute({
      identityCluster,
      snapshots,
      activityStream,
    });

    return NextResponse.json(new ComposePortraitReport().execute(report));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 },
    );
  }
}
