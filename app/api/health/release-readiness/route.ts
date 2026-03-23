import { NextResponse } from 'next/server';
import { HealthCheckService } from '@/src/contexts/platform-governance/domain/services/HealthCheckService';
import { ReleaseReadinessService } from '@/src/contexts/platform-governance/domain/services/ReleaseReadinessService';
import { EnvSwitchProvider } from '@/src/contexts/platform-governance/infrastructure/release/EnvSwitchProvider';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { attachTraceHeaders } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';

export const runtime = 'nodejs';
export const maxDuration = 60;

const healthCheckService = new HealthCheckService();
const switchProvider = new EnvSwitchProvider();
const releaseReadinessService = new ReleaseReadinessService();

export async function GET(request: Request) {
  const observability = ObservabilityContext.fromRequest({
    request,
    route: '/api/health/release-readiness',
    operation: 'health.release-readiness',
  });

  try {
    const health = await healthCheckService.checkAll({
      observability: observability.child('health.all'),
    });
    const snapshot = releaseReadinessService.evaluate({
      mode: switchProvider.getSafetyMode(),
      switches: switchProvider.snapshot(),
      incident: switchProvider.getIncidentState(),
      connectorStatus: health.connectors.status,
      providerStatus: health.narrative.status,
      runtimeStatus: health.runtime.status,
      observability: observability.child('release.readiness'),
    });

    return attachTraceHeaders(
      NextResponse.json(snapshot, { status: snapshot.ready ? 200 : 503 }),
      observability.trace,
    );
  } catch {
    return attachTraceHeaders(
      NextResponse.json(
        {
          ready: false,
          mode: switchProvider.getSafetyMode(),
          blockers: ['release-readiness-route-failed'],
          warnings: [],
          activeSwitches: switchProvider.getIncidentState().activeSwitches,
          checkedAt: new Date().toISOString(),
        },
        { status: 500 },
      ),
      observability.trace,
    );
  }
}
