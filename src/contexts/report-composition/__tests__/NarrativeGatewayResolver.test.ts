import { describe, expect, test } from 'vitest';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import {
  FallbackNarrativeGateway,
  NarrativeGatewayResolver,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { readNarrativeGatewayConfig } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

describe('NarrativeGatewayResolver', () => {
  test('resolves OFF to DisabledNarrativeGateway and RULE_ONLY to RuleOnlyNarrativeGateway', () => {
    const resolver = new NarrativeGatewayResolver({
      config: readNarrativeGatewayConfig({
        NARRATIVE_PROVIDER: 'none',
      }),
    });

    expect(resolver.resolve('OFF')).toBeInstanceOf(DisabledNarrativeGateway);
    expect(resolver.resolve('RULE_ONLY')).toBeInstanceOf(RuleOnlyNarrativeGateway);
  });

  test('resolves LLM_ASSISTED with valid minimax config to a fallback gateway', () => {
    const resolver = new NarrativeGatewayResolver({
      config: readNarrativeGatewayConfig({
        NARRATIVE_PROVIDER: 'minimax',
        NARRATIVE_TIMEOUT_MS: 2500,
        MINIMAX_API_KEY: 'key',
        MINIMAX_BASE_URL: 'https://api.minimax.example/v1',
        MINIMAX_MODEL: 'abab-1.0-chat',
      }),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sections: [
                      {
                        code: 'HEADLINE',
                        content: '模型叙事标题',
                        grounded: true,
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
    });

    const gateway = resolver.resolve('LLM_ASSISTED');

    expect(gateway).toBeInstanceOf(FallbackNarrativeGateway);
  });

  test('resolves LLM_ASSISTED with missing minimax config to rule-only fallback behavior', async () => {
    const resolver = new NarrativeGatewayResolver({
      config: readNarrativeGatewayConfig({
        NARRATIVE_PROVIDER: 'minimax',
      }),
    });

    const gateway = resolver.resolve('LLM_ASSISTED');
    const result = await gateway.generateNarrative(
      makeComposeNarrativeInput({
        mode: 'LLM_ASSISTED',
      }),
    );

    expect(gateway).toBeInstanceOf(FallbackNarrativeGateway);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackMode).toBe('USE_RULE_SUMMARY');
    expect(result.draft?.generatedBy).toBe('RULE_ONLY');
  });
});

