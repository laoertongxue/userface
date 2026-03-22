import { describe, expect, test } from 'vitest';
import { ARCHETYPE_CODES } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import { SIGNAL_CODES } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';
import { TAG_CODES } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';

describe('portrait-analysis modeling codes', () => {
  test('freezes a minimal signal vocabulary', () => {
    expect(SIGNAL_CODES).toEqual([
      'DISCUSSION_HEAVY',
      'TOPIC_LED',
      'HIGH_OUTPUT',
      'LONG_FORM',
      'CROSS_COMMUNITY',
      'LOW_DATA',
      'QUESTION_ORIENTED',
      'FOCUSED_TOPICS',
      'DIVERSE_TOPICS',
    ]);
  });

  test('freezes a minimal external tag vocabulary', () => {
    expect(TAG_CODES).toEqual([
      'DISCUSSION_HEAVY',
      'TOPIC_LED',
      'HIGH_OUTPUT',
      'LONG_FORM',
      'CROSS_COMMUNITY',
      'LOW_DATA',
      'QUESTION_ORIENTED',
      'FOCUSED_TOPICS',
      'DIVERSE_TOPICS',
    ]);
  });

  test('freezes the baseline archetype vocabulary', () => {
    expect(ARCHETYPE_CODES).toEqual([
      'INSUFFICIENT_DATA',
      'DISCUSSION_ORIENTED',
      'TOPIC_ORIENTED',
      'COMMUNITY_PARTICIPANT',
      'OBSERVER',
      'PROBLEM_SOLVER',
      'INFORMATION_CURATOR',
    ]);
  });
});
