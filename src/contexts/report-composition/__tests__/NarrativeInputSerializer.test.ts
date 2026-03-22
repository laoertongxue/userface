import { describe, expect, test } from 'vitest';
import { NarrativeInputSerializer } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeInputSerializer';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

describe('NarrativeInputSerializer', () => {
  test('serializes ComposeNarrativeInput into a compact facts block with controlled evidence excerpts', () => {
    const serializer = new NarrativeInputSerializer();
    const facts = serializer.serialize(
      makeComposeNarrativeInput({
        selectedEvidence: Array.from({ length: 6 }, (_, index) => ({
          id: `ev-${index + 1}`,
          activityId: `a-${index + 1}`,
          community: index % 2 === 0 ? 'v2ex' : 'guozaoke',
          activityType: 'reply',
          labelHint: `Evidence ${index + 1}`,
          excerpt: `Evidence excerpt ${index + 1} `.repeat(40),
          activityUrl: `https://example.com/${index + 1}`,
          publishedAt: `2026-03-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
          reasons: ['substantive-text'],
          textLength: 240,
        })),
      }),
    );

    expect(facts.evidence).toHaveLength(5);
    expect(facts.evidence.every((item) => item.excerpt.length <= 201)).toBe(true);
    expect(JSON.stringify(facts)).not.toContain('sourceTrace');
    expect(JSON.stringify(facts)).not.toContain('perCommunityMetrics');
  });
});

