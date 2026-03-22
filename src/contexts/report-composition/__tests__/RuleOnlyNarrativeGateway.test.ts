import { describe, expect, test } from 'vitest';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

describe('RuleOnlyNarrativeGateway', () => {
  test('generates minimal grounded sections without making network calls', async () => {
    const result = await new RuleOnlyNarrativeGateway().generateNarrative(
      makeComposeNarrativeInput({
        mode: 'RULE_ONLY',
        degraded: true,
        warnings: [
          {
            code: 'PARTIAL_RESULT',
            message: 'Some communities were only partially available.',
          },
        ],
      }),
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.draft).toMatchObject({
      generatedBy: 'RULE_ONLY',
      mode: 'RULE_ONLY',
    });
    expect(result.draft?.sections.map((section) => section.code)).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
      'CAVEATS',
    ]);
  });
});

