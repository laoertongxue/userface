import { NextResponse } from 'next/server';
import { HealthCheckService } from '@/src/contexts/platform-governance/domain/services/HealthCheckService';
import { CronAuth } from '@/src/contexts/platform-governance/infrastructure/health/CronAuth';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { attachTraceHeaders } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';

export const runtime = 'nodejs';
export const maxDuration = 60;

const cronAuth = new CronAuth();
const healthCheckService = new HealthCheckService();

export async function GET(request: Request) {
  const observability = ObservabilityContext.fromRequest({
    request,
    route: '/api/cron/health-probe',
    operation: 'health.cron',
  });

  if (!cronAuth.authorize(request)) {
    return attachTraceHeaders(
      NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cron health probe requires a valid bearer token.',
          },
        },
        { status: 401 },
      ),
      observability.trace,
    );
  }

  try {
    const result = await healthCheckService.checkAll({
      observability: observability.child('health.cron'),
    });

    return attachTraceHeaders(
      NextResponse.json(result, { status: result.status === 'UNHEALTHY' ? 503 : 200 }),
      observability.trace,
    );
  } catch {
    return attachTraceHeaders(
      NextResponse.json(
        {
          status: 'UNHEALTHY',
          checkedAt: new Date().toISOString(),
          warnings: ['health-cron-probe-failed'],
        },
        { status: 500 },
      ),
      observability.trace,
    );
  }
}
