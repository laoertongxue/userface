import { afterEach, describe, expect, test, vi } from 'vitest';

describe('/api/cron/health-probe route', () => {
  afterEach(() => {
    delete process.env.HEALTH_PROBE_CRON_TOKEN;
    delete process.env.CRON_SECRET;
  });

  test('returns 401 when bearer token is missing or invalid', async () => {
    vi.resetModules();
    process.env.HEALTH_PROBE_CRON_TOKEN = 'secret';

    const { GET } = await import('@/app/api/cron/health-probe/route');
    const response = await GET(new Request('http://localhost/api/cron/health-probe'));

    expect(response.status).toBe(401);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Cron health probe requires a valid bearer token.',
      },
    });
  });

  test('returns aggregated health payload when authorized', async () => {
    vi.resetModules();
    process.env.HEALTH_PROBE_CRON_TOKEN = 'secret';
    vi.doMock('@/src/contexts/platform-governance/domain/services/HealthCheckService', () => ({
      HealthCheckService: class HealthCheckService {
        async checkAll() {
          return {
            status: 'DEGRADED',
            checkedAt: '2026-03-23T10:00:00.000Z',
            connectors: { status: 'HEALTHY', checkedAt: '2026-03-23T10:00:00.000Z', targets: [], warnings: [] },
            narrative: { status: 'DEGRADED', checkedAt: '2026-03-23T10:00:00.000Z', targets: [], warnings: ['provider-not-configured'] },
            runtime: { status: 'HEALTHY', checkedAt: '2026-03-23T10:00:00.000Z', targets: [], warnings: [], blockers: [] },
            warnings: ['provider-not-configured'],
          };
        }
      },
    }));

    const { GET } = await import('@/app/api/cron/health-probe/route');
    const response = await GET(
      new Request('http://localhost/api/cron/health-probe', {
        headers: {
          authorization: 'Bearer secret',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      status: 'DEGRADED',
      connectors: {
        status: 'HEALTHY',
      },
      narrative: {
        status: 'DEGRADED',
      },
      runtime: {
        status: 'HEALTHY',
      },
    });
  });
});
