import { describe, expect, test } from 'vitest';
import {
  CLUSTER_WORKFLOW_GOLDEN_CASES,
  getClusterWorkflowGoldenCase,
} from '@/src/app-services/analyze/__tests__/regression/clusterWorkflow.goldenCases';
import { runClusterWorkflowGoldenCase } from '@/src/app-services/analyze/__tests__/regression/helpers';

describe('cluster workflow regression', () => {
  test('single-account cluster path remains backward compatible', async () => {
    const goldenCase = getClusterWorkflowGoldenCase('single-account-compatible');
    const result = await runClusterWorkflowGoldenCase(goldenCase);

    expect(result.error).toBeUndefined();
    expect(result.report).toBeDefined();
    expect(result.report?.portrait).toEqual(
      expect.objectContaining({
        archetype: expect.any(String),
        summary: expect.any(String),
      }),
    );
    expect(result.report?.communityBreakdowns).toHaveLength(1);
    expect(result.report?.cluster?.accountCoverage).toMatchObject({
      requestedAccounts: [expect.objectContaining({ community: 'v2ex', handle: 'solo-user' })],
      successfulCount: 1,
      failedCount: 0,
      activeCommunities: ['v2ex'],
    });
  });

  test('multi-account orchestration golden cases keep success, failure, and dedupe semantics stable', async () => {
    for (const goldenCase of CLUSTER_WORKFLOW_GOLDEN_CASES) {
      const result = await runClusterWorkflowGoldenCase(goldenCase);

      if (!goldenCase.expectations.shouldSucceed) {
        expect(result.report).toBeUndefined();
        expect(result.error?.message).toContain('No account snapshots could be fetched');
        continue;
      }

      expect(result.error).toBeUndefined();
      expect(result.report).toBeDefined();
      expect(result.report?.cluster?.accountCoverage.failedCount).toBe(
        goldenCase.expectations.failedCount,
      );
      expect(result.report?.cluster?.accountCoverage.requestedAccounts).toHaveLength(
        goldenCase.expectations.requestedCount ?? 0,
      );

      if (goldenCase.expectations.activeCommunities) {
        expect(result.report?.cluster?.accountCoverage.activeCommunities).toEqual(
          goldenCase.expectations.activeCommunities,
        );
      }

      if (goldenCase.expectations.degraded === true) {
        expect(result.report?.warnings.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test('duplicate account golden case only fetches one unique account and keeps coverage compact', async () => {
    const result = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('duplicate-account-input'),
    );

    expect(result.error).toBeUndefined();
    expect(result.fetchCalls).toEqual(['v2ex:duplicate-user']);
    expect(result.report?.cluster?.accountCoverage.requestedAccounts).toEqual([
      expect.objectContaining({
        community: 'v2ex',
        handle: 'duplicate-user',
      }),
    ]);
    expect(result.report?.metrics.totalActivities).toBe(8);
  });

  test('partial success golden case preserves report generation while marking degraded account coverage', async () => {
    const result = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('partial-success-cluster'),
    );

    expect(result.error).toBeUndefined();
    expect(result.report?.cluster?.accountCoverage).toMatchObject({
      successfulCount: 1,
      failedCount: 1,
    });
    expect(result.report?.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['PARTIAL_RESULT']),
    );
  });

  test('suggestion boundary remains separate from analysis facts', async () => {
    const result = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('dual-account-cross-community'),
    );

    expect(result.error).toBeUndefined();
    expect(result.report?.cluster?.accountCoverage.requestedAccounts).toHaveLength(2);
    expect(result.report).not.toHaveProperty('suggestions');
    expect(result.report).not.toHaveProperty('links');
  });
});
