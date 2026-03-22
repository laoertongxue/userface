import { describe, expect, test } from 'vitest';
import {
  getClusterWorkflowGoldenCase,
} from '@/src/app-services/analyze/__tests__/regression/clusterWorkflow.goldenCases';
import { runClusterWorkflowGoldenCase } from '@/src/app-services/analyze/__tests__/regression/helpers';

describe('cluster aggregated report regression', () => {
  test('single-account reports keep legacy fields and treat cluster enhancements as optional', async () => {
    const { report, error } = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('single-account-compatible'),
    );

    expect(error).toBeUndefined();
    expect(report).toMatchObject({
      portrait: expect.objectContaining({
        archetype: expect.any(String),
        tags: expect.any(Array),
        summary: expect.any(String),
        confidence: expect.any(Number),
      }),
      evidence: expect.any(Array),
      metrics: expect.objectContaining({
        totalActivities: expect.any(Number),
        topicCount: expect.any(Number),
        replyCount: expect.any(Number),
        avgTextLength: expect.any(Number),
        activeDays: expect.any(Number),
      }),
      communityBreakdowns: expect.any(Array),
      warnings: expect.any(Array),
    });
    expect(report?.cluster?.overlap ?? []).toEqual([]);
    expect(report?.cluster?.divergence ?? []).toEqual([]);
  });

  test('cross-community cluster reports expose stable traits, community-specific traits, overlap/divergence, confidence, and account coverage', async () => {
    const { report, error } = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('dual-account-cross-community'),
    );

    expect(error).toBeUndefined();
    expect(report?.cluster).toMatchObject({
      stableTraits: expect.any(Array),
      communitySpecificTraits: expect.any(Object),
      confidence: expect.objectContaining({
        overall: expect.any(Number),
        reasons: expect.any(Array),
        flags: expect.any(Array),
      }),
      accountCoverage: expect.objectContaining({
        requestedAccounts: expect.any(Array),
        successfulAccounts: expect.any(Array),
        failedAccounts: expect.any(Array),
        successfulCount: 2,
        failedCount: 0,
        activeCommunities: ['guozaoke', 'v2ex'],
      }),
    });
    expect(report?.cluster?.stableTraits.length ?? 0).toBeGreaterThan(0);
    expect(Object.keys(report?.cluster?.communitySpecificTraits ?? {})).toEqual(
      expect.arrayContaining(['guozaoke', 'v2ex']),
    );
    expect(report?.cluster?.overlap?.length ?? 0).toBeGreaterThan(0);
    expect(report?.cluster?.divergence?.length ?? 0).toBeGreaterThan(0);
    expect(report?.communityBreakdowns).toHaveLength(2);
  });

  test('cluster confidence stays lower for partial success than full cross-community success', async () => {
    const full = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('dual-account-cross-community'),
    );
    const partial = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('partial-success-cluster'),
    );

    expect(full.error).toBeUndefined();
    expect(partial.error).toBeUndefined();
    expect(full.report?.cluster?.confidence?.overall ?? 0).toBeGreaterThan(
      partial.report?.cluster?.confidence?.overall ?? 1,
    );
    expect(partial.report?.cluster?.confidence?.flags).toEqual(
      expect.arrayContaining(['DEGRADED_SOURCE', 'PARTIAL_ACCOUNT_FAILURE']),
    );
  });

  test('account coverage stays deduped and stable for duplicate-account input', async () => {
    const { report, error } = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('duplicate-account-input'),
    );

    expect(error).toBeUndefined();
    expect(report?.cluster?.accountCoverage).toMatchObject({
      requestedAccounts: [expect.objectContaining({ handle: 'duplicate-user' })],
      successfulAccounts: [expect.objectContaining({ handle: 'duplicate-user' })],
      failedAccounts: [],
      successfulCount: 1,
      failedCount: 0,
      activeCommunities: ['v2ex'],
    });
    expect(report?.communityBreakdowns).toHaveLength(1);
  });

  test('warnings survive report composition for degraded partial-success clusters', async () => {
    const { report, error } = await runClusterWorkflowGoldenCase(
      getClusterWorkflowGoldenCase('partial-success-cluster'),
    );

    expect(error).toBeUndefined();
    expect(report?.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['PARTIAL_RESULT']),
    );
    expect(report?.portrait.summary).toContain('谨慎');
    expect(report?.communityBreakdowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          community: 'v2ex',
          handle: 'partial-alpha',
        }),
      ]),
    );
  });
});
