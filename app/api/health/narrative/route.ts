import { NextResponse } from 'next/server';
import { HealthCheckService } from '@/src/contexts/platform-governance/domain/services/HealthCheckService';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { attachTraceHeaders } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';

export const runtime = 'nodejs';
export const maxDuration = 60;

const healthCheckService = new HealthCheckService();

export async function GET(request: Request) {
  const observability = ObservabilityContext.fromRequest({
    request,
    route: '/api/health/narrative',
    operation: 'health.narrative',
  });

  try {
    const result = await healthCheckService.checkNarrative({
      observability: observability.child('health.narrative'),
    });

    return attachTraceHeaders(
      NextResponse.json(
        {
          status: result.status,
          checkedAt: result.checkedAt,
          targets: result.targets,
          warnings: result.warnings,
        },
        { status: result.status === 'UNHEALTHY' ? 503 : 200 },
      ),
      observability.trace,
    );
  } catch {
    return attachTraceHeaders(
      NextResponse.json(
        {
          status: 'UNHEALTHY',
          checkedAt: new Date().toISOString(),
          targets: [],
          warnings: ['narrative-health-route-failed'],
        },
        { status: 500 },
      ),
      observability.trace,
    );
  }
}
