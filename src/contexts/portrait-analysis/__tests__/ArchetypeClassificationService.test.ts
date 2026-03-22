import { describe, expect, test } from 'vitest';
import { ArchetypeClassificationService } from '@/src/contexts/portrait-analysis/domain/services/ArchetypeClassificationService';
import {
  makeConfidenceProfile,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';

function tags(codes: PortraitTag['code'][]): PortraitTag[] {
  return codes.map((code) => ({
    code,
    displayName: code.toLowerCase(),
    summaryHint: 'hint',
    supportingSignalCodes: [code as SignalCode],
  }));
}

describe('ArchetypeClassificationService', () => {
  test('returns INSUFFICIENT_DATA for clearly weak samples', () => {
    const result = new ArchetypeClassificationService().classify({
      featureVector: makeFeatureVector({
        dataQuality: {
          sufficientData: false,
          qualityFlags: ['LOW_ACTIVITY_VOLUME'],
        },
      }),
      signals: [makeSignal({ code: 'LOW_DATA', score: 0.9 })],
      tags: tags(['LOW_DATA']),
      confidenceProfile: makeConfidenceProfile({ overall: 0.25 }),
    });

    expect(result.code).toBe('INSUFFICIENT_DATA');
  });

  test('returns DISCUSSION_ORIENTED for a strong reply-heavy sample', () => {
    const result = new ArchetypeClassificationService().classify({
      featureVector: makeFeatureVector({
        activity: {
          totalActivities: 16,
          topicCount: 4,
          replyCount: 12,
          topicRatio: 0.25,
          replyRatio: 0.75,
          activeDays: 5,
        },
        content: {
          substantiveTextRatio: 0.45,
          questionRatio: 0.32,
        },
      }),
      signals: [makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.78 })],
      tags: tags(['DISCUSSION_HEAVY']),
      confidenceProfile: makeConfidenceProfile({ overall: 0.7 }),
    });

    expect(result.code).toBe('DISCUSSION_ORIENTED');
  });

  test('returns INFORMATION_CURATOR for strong topic-led structured output', () => {
    const result = new ArchetypeClassificationService().classify({
      featureVector: makeFeatureVector({
        activity: {
          totalActivities: 18,
          topicCount: 12,
          replyCount: 6,
          topicRatio: 0.6667,
          replyRatio: 0.3333,
        },
        content: {
          linkRatio: 0.18,
        },
      }),
      signals: [
        makeSignal({ code: 'TOPIC_LED', score: 0.8 }),
        makeSignal({ code: 'LONG_FORM', score: 0.7 }),
      ],
      tags: tags(['TOPIC_LED', 'LONG_FORM']),
      confidenceProfile: makeConfidenceProfile({ overall: 0.78 }),
    });

    expect(result.code).toBe('INFORMATION_CURATOR');
  });

  test('does not let observer override insufficient-data', () => {
    const result = new ArchetypeClassificationService().classify({
      featureVector: makeFeatureVector({
        activity: {
          totalActivities: 4,
          activeDays: 4,
          activeSpanDays: 12,
          avgActivitiesPerActiveDay: 1,
        },
        dataQuality: {
          sufficientData: false,
          qualityFlags: ['LOW_ACTIVITY_VOLUME'],
        },
      }),
      signals: [makeSignal({ code: 'LOW_DATA', score: 0.84 })],
      tags: tags(['LOW_DATA']),
      confidenceProfile: makeConfidenceProfile({ overall: 0.33 }),
    });

    expect(result.code).toBe('INSUFFICIENT_DATA');
  });
});
