import { describe, expect, test } from 'vitest';
import { NarrativePromptBuilder } from '@/src/contexts/report-composition/domain/services/NarrativePromptBuilder';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

describe('NarrativePromptBuilder', () => {
  test('builds strict JSON prompt messages with grounded and conservative guardrails', () => {
    const payload = new NarrativePromptBuilder().build(
      makeComposeNarrativeInput({
        mode: 'LLM_ASSISTED',
        degraded: true,
        warnings: [
          {
            code: 'PARTIAL_RESULT',
            message: 'Some communities were partially available.',
          },
        ],
      }),
    );

    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0]?.content).toContain('strict JSON');
    expect(payload.messages[0]?.content).toContain('Do not invent facts');
    expect(payload.messages[0]?.content).toContain('conservative');
    expect(payload.messages[1]?.content).toContain('"requiresCaveats":true');
    expect(payload.messages[1]?.content).toContain('"facts"');
  });
});

