import { describe, expect, test } from 'vitest';
import { GOLDEN_CASES, getGoldenCase } from '@/src/contexts/portrait-analysis/__tests__/regression/goldenCases';
import { runPortraitAnalysis } from '@/src/contexts/portrait-analysis/__tests__/regression/helpers';

describe('portrait report regression', () => {
  test('top-level PortraitReport structure remains compatible across golden cases', async () => {
    for (const goldenCase of GOLDEN_CASES) {
      const { report } = await runPortraitAnalysis(goldenCase.input);

      expect(report).toMatchObject({
        portrait: {
          archetype: expect.any(String),
          tags: expect.any(Array),
          summary: expect.any(String),
          confidence: expect.any(Number),
        },
        evidence: expect.any(Array),
        metrics: {
          totalActivities: expect.any(Number),
          topicCount: expect.any(Number),
          replyCount: expect.any(Number),
          avgTextLength: expect.any(Number),
          activeDays: expect.any(Number),
        },
        communityBreakdowns: expect.any(Array),
        warnings: expect.any(Array),
        cluster: expect.objectContaining({
          stableTraits: expect.any(Array),
          communitySpecificTraits: expect.any(Object),
          accountCoverage: expect.objectContaining({
            requestedAccounts: expect.any(Array),
            successfulAccounts: expect.any(Array),
            failedAccounts: expect.any(Array),
          }),
        }),
      });
    }
  });

  test('report metrics stay aligned with FeatureVector, not ad-hoc recounting', async () => {
    const { analysis, report } = await runPortraitAnalysis(
      getGoldenCase('topic-led-output-heavy-single-community').input,
    );

    expect(report.metrics).toEqual({
      totalActivities: analysis.featureVector.activity.totalActivities,
      topicCount: analysis.featureVector.activity.topicCount,
      replyCount: analysis.featureVector.activity.replyCount,
      avgTextLength: analysis.featureVector.content.avgTextLength,
      activeDays: analysis.featureVector.activity.activeDays,
    });
  });

  test('report evidence stays sourced from selectedEvidence and does not duplicate items', async () => {
    const { analysis, report } = await runPortraitAnalysis(
      getGoldenCase('long-form-substantive').input,
    );

    expect(report.evidence.length).toBeLessThanOrEqual(analysis.selectedEvidence.length);
    expect(new Set(report.evidence.map((item) => `${item.activityUrl}:${item.excerpt}`)).size).toBe(
      report.evidence.length,
    );
    expect(report.evidence).toEqual(
      expect.arrayContaining(
        analysis.selectedEvidence.slice(0, report.evidence.length).map((candidate) =>
          expect.objectContaining({
            activityUrl: candidate.activityUrl,
            community: candidate.community,
            publishedAt: candidate.publishedAt,
          }),
        ),
      ),
    );
  });

  test('report output remains cautious for low-data and degraded cases', async () => {
    const lowData = (await runPortraitAnalysis(getGoldenCase('low-data-insufficient').input)).report;
    const degraded = (await runPortraitAnalysis(getGoldenCase('degraded-source-partial-result').input)).report;

    expect(lowData.portrait.archetype).toBe('insufficient-data');
    expect(lowData.portrait.tags).toContain('low-data');
    expect(lowData.portrait.summary).toContain('当前样本有限');

    expect(degraded.portrait.summary).toContain('谨慎');
    expect(degraded.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PARTIAL_RESULT',
        }),
      ]),
    );
  });

  test('community breakdowns remain minimal for single-community and differentiated for cross-community cases', async () => {
    const single = (await runPortraitAnalysis(
      getGoldenCase('discussion-heavy-single-community').input,
    )).report;
    const cross = (await runPortraitAnalysis(getGoldenCase('cross-community-balanced').input)).report;

    expect(single.communityBreakdowns).toHaveLength(1);
    expect(single.communityBreakdowns[0]).toMatchObject({
      community: 'v2ex',
      handle: 'discussor',
    });

    expect(cross.communityBreakdowns).toHaveLength(2);
    expect(cross.communityBreakdowns[0]?.summary).not.toBe(cross.communityBreakdowns[1]?.summary);
    expect(cross.communityBreakdowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          community: 'guozaoke',
          metrics: expect.objectContaining({
            totalActivities: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          community: 'v2ex',
          metrics: expect.objectContaining({
            totalActivities: expect.any(Number),
          }),
        }),
      ]),
    );
  });

  test('cluster insights stay minimal for single-community and richer for cross-community cases', async () => {
    const single = (await runPortraitAnalysis(
      getGoldenCase('discussion-heavy-single-community').input,
    )).report;
    const cross = (await runPortraitAnalysis(getGoldenCase('cross-community-balanced').input)).report;

    expect(single.cluster?.stableTraits.length ?? 0).toBeGreaterThan(0);
    expect(single.cluster?.overlap ?? []).toEqual([]);
    expect(single.cluster?.accountCoverage.successfulCount).toBe(1);

    expect(cross.cluster?.stableTraits.length ?? 0).toBeGreaterThan(0);
    expect(Object.keys(cross.cluster?.communitySpecificTraits ?? {})).toEqual(
      expect.arrayContaining(['guozaoke', 'v2ex']),
    );
    expect(cross.cluster?.accountCoverage.successfulCount).toBe(2);
  });
});
