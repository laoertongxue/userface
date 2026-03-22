import { describe, expect, test } from 'vitest';
import { GOLDEN_CASES, getGoldenCase } from '@/src/contexts/portrait-analysis/__tests__/regression/goldenCases';
import { runPortraitAnalysis } from '@/src/contexts/portrait-analysis/__tests__/regression/helpers';
import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';

function cloneInput<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('portrait engine regression', () => {
  test('feature extraction remains stable for the discussion-heavy golden case', async () => {
    const { analysis } = await runPortraitAnalysis(
      getGoldenCase('discussion-heavy-single-community').input,
    );

    expect(analysis.featureVector.activity).toMatchObject({
      totalActivities: 10,
      topicCount: 3,
      replyCount: 7,
      activeDays: 5,
      activeCommunityCount: 1,
    });
    expect(analysis.featureVector.community.perCommunityMetrics).toMatchObject({
      'v2ex:discussor': expect.objectContaining({
        totalActivities: 10,
        topicCount: 3,
        replyCount: 7,
        activeDays: 5,
      }),
    });
  });

  test('evidence selection remains bounded, deduped, and coverage-aware across golden cases', async () => {
    for (const goldenCase of GOLDEN_CASES) {
      const { analysis } = await runPortraitAnalysis(goldenCase.input);
      const evidenceIds = analysis.selectedEvidence.map((item) => item.id);

      expect(new Set(evidenceIds).size).toBe(evidenceIds.length);
      expect(analysis.selectedEvidence.length).toBeGreaterThanOrEqual(
        goldenCase.expectations.minEvidence ?? 1,
      );
      expect(analysis.selectedEvidence.length).toBeLessThanOrEqual(
        goldenCase.expectations.maxEvidence ?? 5,
      );
    }

    const crossCommunity = (await runPortraitAnalysis(getGoldenCase('cross-community-balanced').input)).analysis;
    expect(new Set(crossCommunity.selectedEvidence.map((item) => item.community)).size).toBeGreaterThanOrEqual(2);

    const lowData = (await runPortraitAnalysis(getGoldenCase('low-data-insufficient').input)).analysis;
    expect(lowData.selectedEvidence.length).toBeLessThanOrEqual(3);
  });

  test('confidence ordering stays stable for low-data, strong-basis, and degraded cases', async () => {
    const lowData = (await runPortraitAnalysis(getGoldenCase('low-data-insufficient').input)).analysis;
    const strongBasis = (await runPortraitAnalysis(
      getGoldenCase('topic-led-output-heavy-single-community').input,
    )).analysis;
    const degraded = (await runPortraitAnalysis(
      getGoldenCase('degraded-source-partial-result').input,
    )).analysis;
    const cleanDegradedLike: AnalyzePortraitInput = cloneInput(
      getGoldenCase('degraded-source-partial-result').input,
    );

    cleanDegradedLike.snapshots = cleanDegradedLike.snapshots.map((snapshot) => ({
      ...snapshot,
      diagnostics: {
        ...snapshot.diagnostics,
        degraded: false,
      },
      warnings: [],
    }));

    const cleanVariant = (await runPortraitAnalysis(cleanDegradedLike)).analysis;

    expect(lowData.confidenceProfile.overall).toBeLessThan(strongBasis.confidenceProfile.overall);
    expect(degraded.confidenceProfile.overall).toBeLessThan(cleanVariant.confidenceProfile.overall);
    expect(degraded.confidenceProfile.flags).toContain('DEGRADED_SOURCE');
  });

  test('signals, tags, and archetypes remain inside expected boundaries for golden cases', async () => {
    for (const goldenCase of GOLDEN_CASES) {
      const { analysis } = await runPortraitAnalysis(goldenCase.input);
      const signalCodes = analysis.signals.map((signal) => signal.code);
      const tagCodes = analysis.tags.map((tag) => tag.code);

      expect(goldenCase.expectations.archetypeIn).toContain(analysis.primaryArchetype.code);

      for (const code of goldenCase.expectations.mustHaveSignals ?? []) {
        expect(signalCodes).toContain(code);
      }

      for (const code of goldenCase.expectations.mustHaveTags ?? []) {
        expect(tagCodes).toContain(code);
      }

      for (const code of goldenCase.expectations.mustNotHaveTags ?? []) {
        expect(tagCodes).not.toContain(code);
      }
    }

    const lowData = (await runPortraitAnalysis(getGoldenCase('low-data-insufficient').input)).analysis;

    expect(lowData.primaryArchetype.code).toBe('INSUFFICIENT_DATA');
    expect(lowData.tags.map((tag) => tag.code)).toContain('LOW_DATA');
    expect(lowData.tags.length).toBeLessThanOrEqual(3);
  });
});
