import { describe, expect, test } from 'vitest';
import { GOLDEN_CASES } from '@/src/contexts/portrait-analysis/__tests__/regression/goldenCases';
import { runPortraitAnalysis } from '@/src/contexts/portrait-analysis/__tests__/regression/helpers';

describe('portrait pipeline compatibility regression', () => {
  test('AnalyzeIdentityCluster and ComposePortraitReport remain compatible with the existing UI-facing envelope', () => {
    for (const goldenCase of GOLDEN_CASES) {
      const { analysis, report } = runPortraitAnalysis(goldenCase.input);

      expect(analysis).toMatchObject({
        archetype: expect.any(String),
        confidenceProfile: expect.objectContaining({
          overall: expect.any(Number),
        }),
        featureVector: expect.any(Object),
        selectedEvidence: expect.any(Array),
        signals: expect.any(Array),
        tags: expect.any(Array),
        warnings: expect.any(Array),
      });

      expect(report).toMatchObject({
        portrait: {
          archetype: expect.any(String),
          tags: expect.any(Array),
          summary: expect.any(String),
          confidence: expect.any(Number),
        },
        evidence: expect.any(Array),
        metrics: expect.any(Object),
        communityBreakdowns: expect.any(Array),
        warnings: expect.any(Array),
      });
    }
  });
});
