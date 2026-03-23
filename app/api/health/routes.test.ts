import { describe, expect, test, vi } from 'vitest';

describe('/api/health routes', () => {
  test('connectors route returns stable structure without sensitive values', async () => {
    vi.resetModules();
    vi.doMock('@/src/contexts/platform-governance/domain/services/HealthCheckService', () => ({
      HealthCheckService: class HealthCheckService {
        async checkConnectors() {
          return {
            status: 'HEALTHY',
            checkedAt: '2026-03-23T10:00:00.000Z',
            targets: [
              {
                community: 'v2ex',
                status: 'HEALTHY',
                warnings: [],
                degraded: false,
              },
            ],
            warnings: [],
          };
        }
      },
    }));

    const { GET } = await import('@/app/api/health/connectors/route');
    const response = await GET(new Request('http://localhost/api/health/connectors'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toEqual({
      status: 'HEALTHY',
      checkedAt: '2026-03-23T10:00:00.000Z',
      targets: [
        {
          community: 'v2ex',
          status: 'HEALTHY',
          warnings: [],
          degraded: false,
        },
      ],
      warnings: [],
    });
  });

  test('narrative route returns stable structure', async () => {
    vi.resetModules();
    vi.doMock('@/src/contexts/platform-governance/domain/services/HealthCheckService', () => ({
      HealthCheckService: class HealthCheckService {
        async checkNarrative() {
          return {
            status: 'DEGRADED',
            checkedAt: '2026-03-23T10:00:00.000Z',
            targets: [
              {
                provider: 'minimax',
                status: 'DEGRADED',
                warnings: ['provider-not-configured'],
              },
            ],
            warnings: ['provider-not-configured'],
          };
        }
      },
    }));

    const { GET } = await import('@/app/api/health/narrative/route');
    const response = await GET(new Request('http://localhost/api/health/narrative'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      status: 'DEGRADED',
      targets: [
        {
          provider: 'minimax',
          status: 'DEGRADED',
        },
      ],
    });
  });

  test('runtime route returns stable structure with blockers but not secrets', async () => {
    vi.resetModules();
    vi.doMock('@/src/contexts/platform-governance/domain/services/HealthCheckService', () => ({
      HealthCheckService: class HealthCheckService {
        checkRuntime() {
          return {
            status: 'DEGRADED',
            checkedAt: '2026-03-23T10:00:00.000Z',
            targets: [
              {
                targetType: 'runtime',
                targetId: 'cron.auth',
                status: 'DEGRADED',
              },
            ],
            warnings: ['cron-auth-missing'],
            blockers: [],
          };
        }
      },
    }));

    const { GET } = await import('@/app/api/health/runtime/route');
    const response = await GET(new Request('http://localhost/api/health/runtime'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(await response.json()).toEqual({
      status: 'DEGRADED',
      checkedAt: '2026-03-23T10:00:00.000Z',
      targets: [
        {
          targetType: 'runtime',
          targetId: 'cron.auth',
          status: 'DEGRADED',
        },
      ],
      warnings: ['cron-auth-missing'],
      blockers: [],
    });
  });

  test('release-readiness route returns stable readiness structure without sensitive values', async () => {
    vi.resetModules();
    vi.doMock('@/src/contexts/platform-governance/domain/services/HealthCheckService', () => ({
      HealthCheckService: class HealthCheckService {
        async checkAll() {
          return {
            status: 'DEGRADED',
            checkedAt: '2026-03-23T10:00:00.000Z',
            connectors: {
              status: 'HEALTHY',
              checkedAt: '2026-03-23T10:00:00.000Z',
              targets: [],
              warnings: [],
            },
            narrative: {
              status: 'DEGRADED',
              checkedAt: '2026-03-23T10:00:00.000Z',
              targets: [],
              warnings: ['provider-not-configured'],
            },
            runtime: {
              status: 'HEALTHY',
              checkedAt: '2026-03-23T10:00:00.000Z',
              targets: [],
              warnings: [],
              blockers: [],
            },
            warnings: ['provider-not-configured'],
          };
        }
      },
    }));

    const { GET } = await import('@/app/api/health/release-readiness/route');
    const response = await GET(new Request('http://localhost/api/health/release-readiness'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(json).toMatchObject({
      ready: true,
      mode: 'NORMAL',
      blockers: [],
      warnings: ['narrative-provider-degraded'],
      activeSwitches: [],
    });
    expect(JSON.stringify(json)).not.toContain('MINIMAX_API_KEY');
  });
});
