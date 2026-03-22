import { describe, expect, test } from 'vitest';
import { NarrativeGatewayError } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import { NarrativeResponseParser } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeResponseParser';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

describe('NarrativeResponseParser', () => {
  test('parses valid structured output into a normalized NarrativeDraft', () => {
    const parser = new NarrativeResponseParser();
    const input = makeComposeNarrativeInput({
      mode: 'LLM_ASSISTED',
      selectedEvidence: [
        {
          id: 'ev-1',
          activityId: 'a-1',
          community: 'v2ex',
          activityType: 'reply',
          labelHint: 'Representative reply',
          excerpt: 'Evidence one.',
          activityUrl: 'https://example.com/1',
          publishedAt: '2026-03-20T00:00:00.000Z',
          reasons: ['substantive-text'],
          textLength: 80,
        },
      ],
    });

    const draft = parser.parse(
      JSON.stringify({
        sections: [
          {
            code: 'SHORT_SUMMARY',
            content: '  模型摘要  ',
            sourceHints: ['portrait.summary'],
            supportingEvidenceIds: ['ev-1'],
          },
          {
            code: 'HEADLINE',
            content: '模型标题',
            sourceHints: ['portrait.archetype'],
            supportingEvidenceIds: ['ev-1'],
          },
        ],
      }),
      input,
    );

    expect(draft.sections.map((section) => section.code)).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
    ]);
    expect(draft.sections[1]?.content).toBe('模型摘要');
  });

  test('rejects invalid section codes', () => {
    const parser = new NarrativeResponseParser();

    expect(() =>
      parser.parse(
        JSON.stringify({
          sections: [
            {
              code: 'INVALID_CODE',
              content: 'bad',
            },
          ],
        }),
        makeComposeNarrativeInput({
          mode: 'LLM_ASSISTED',
        }),
      ),
    ).toThrowError(NarrativeGatewayError);
  });

  test('rejects invented supportingEvidenceIds', () => {
    const parser = new NarrativeResponseParser();

    expect(() =>
      parser.parse(
        JSON.stringify({
          sections: [
            {
              code: 'HEADLINE',
              content: '模型标题',
              supportingEvidenceIds: ['unknown-evidence'],
            },
            {
              code: 'SHORT_SUMMARY',
              content: '模型摘要',
            },
          ],
        }),
        makeComposeNarrativeInput({
          mode: 'LLM_ASSISTED',
        }),
      ),
    ).toThrowError(NarrativeGatewayError);
  });

  test('requires CAVEATS for degraded or low-data narrative input', () => {
    const parser = new NarrativeResponseParser();

    expect(() =>
      parser.parse(
        JSON.stringify({
          sections: [
            {
              code: 'HEADLINE',
              content: '模型标题',
            },
            {
              code: 'SHORT_SUMMARY',
              content: '模型摘要',
            },
          ],
        }),
        makeComposeNarrativeInput({
          mode: 'LLM_ASSISTED',
          degraded: true,
          warnings: [
            {
              code: 'PARTIAL_RESULT',
              message: 'Partial upstream coverage.',
            },
          ],
        }),
      ),
    ).toThrowError(NarrativeGatewayError);
  });
});

