import { describe, expect, test } from 'vitest';
import { TagCompositionService } from '@/src/contexts/portrait-analysis/domain/services/TagCompositionService';
import {
  makeConfidenceProfile,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';

describe('TagCompositionService', () => {
  test('composes tags from sufficiently strong signals', () => {
    const tags = new TagCompositionService().compose({
      signals: [
        makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.8 }),
        makeSignal({ code: 'HIGH_OUTPUT', score: 0.72 }),
      ],
      confidenceProfile: makeConfidenceProfile({ overall: 0.74 }),
    });

    expect(tags.map((tag) => tag.code)).toEqual(
      expect.arrayContaining(['DISCUSSION_HEAVY', 'HIGH_OUTPUT']),
    );
  });

  test('keeps LOW_DATA and suppresses tag count when the low-data signal is strong', () => {
    const tags = new TagCompositionService().compose({
      signals: [
        makeSignal({ code: 'LOW_DATA', score: 0.86 }),
        makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.7 }),
        makeSignal({ code: 'TOPIC_LED', score: 0.69 }),
        makeSignal({ code: 'LONG_FORM', score: 0.66 }),
        makeSignal({ code: 'CROSS_COMMUNITY', score: 0.64 }),
      ],
      confidenceProfile: makeConfidenceProfile({ overall: 0.34 }),
    });

    expect(tags.map((tag) => tag.code)).toContain('LOW_DATA');
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  test('does not emit focused and diverse topic tags together by default', () => {
    const tags = new TagCompositionService().compose({
      signals: [
        makeSignal({ code: 'FOCUSED_TOPICS', score: 0.7 }),
        makeSignal({ code: 'DIVERSE_TOPICS', score: 0.66 }),
      ],
      confidenceProfile: makeConfidenceProfile({ overall: 0.72 }),
    });

    const topicShapeTags = tags.filter(
      (tag) => tag.code === 'FOCUSED_TOPICS' || tag.code === 'DIVERSE_TOPICS',
    );

    expect(topicShapeTags).toHaveLength(1);
    expect(topicShapeTags[0]?.code).toBe('FOCUSED_TOPICS');
  });
});
