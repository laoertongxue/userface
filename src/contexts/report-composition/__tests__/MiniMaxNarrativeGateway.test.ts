import { describe, expect, test, vi } from 'vitest';
import { MiniMaxNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/MiniMaxNarrativeGateway';
import {
  readNarrativeGatewayConfig,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import {
  NarrativeGatewayError,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import {
  FallbackNarrativeGateway,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

function makeConfig() {
  return readNarrativeGatewayConfig({
    NARRATIVE_PROVIDER: 'minimax',
    NARRATIVE_TIMEOUT_MS: 1500,
    MINIMAX_API_KEY: 'key',
    MINIMAX_BASE_URL: 'https://api.minimax.example/v1',
    MINIMAX_MODEL: 'abab-1.0-chat',
  });
}

describe('MiniMaxNarrativeGateway', () => {
  test('parses a compatible provider response into a NarrativeGenerationResult', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '```json\n{"sections":[{"code":"SHORT_SUMMARY","content":"模型摘要","sourceHints":["portrait.summary"],"supportingEvidenceIds":["e1"]},{"code":"HEADLINE","content":"模型标题","sourceHints":["portrait.archetype"],"supportingEvidenceIds":["e1"]}]}\n```',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await new MiniMaxNarrativeGateway(makeConfig(), fetchImpl).generateNarrative(
      makeComposeNarrativeInput({
        mode: 'LLM_ASSISTED',
        tone: 'CONCISE',
        audience: 'PRODUCT_USER',
      }),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.fallbackUsed).toBe(false);
    expect(result.draft).toMatchObject({
      generatedBy: 'LLM_ASSISTED',
      tone: 'CONCISE',
      audience: 'PRODUCT_USER',
    });
    const requestInit = (fetchImpl.mock.calls[0] as unknown[] | undefined)?.[1] as RequestInit | undefined;
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody.messages[0].content).toContain('strict JSON');
    expect(requestBody.messages[1].content).toContain('"facts"');
    expect(result.draft?.sections.map((section) => section.code)).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
    ]);
  });

  test('maps an invalid provider response to NarrativeGatewayError.INVALID_RESPONSE', async () => {
    const gateway = new MiniMaxNarrativeGateway(
      makeConfig(),
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'not-json',
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );

    await expect(
      gateway.generateNarrative(
        makeComposeNarrativeInput({
          mode: 'LLM_ASSISTED',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    } satisfies Partial<NarrativeGatewayError>);
  });

  test('maps AbortError to TIMEOUT', async () => {
    const gateway = new MiniMaxNarrativeGateway(makeConfig(), async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });

    await expect(
      gateway.generateNarrative(
        makeComposeNarrativeInput({
          mode: 'LLM_ASSISTED',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
    } satisfies Partial<NarrativeGatewayError>);
  });

  test('fallback wrapper catches MiniMax failure and returns rule-only draft', async () => {
    const failingMiniMax = new MiniMaxNarrativeGateway(makeConfig(), async () =>
      new Response('upstream error', { status: 503 }),
    );
    const fallbackGateway = new FallbackNarrativeGateway(
      failingMiniMax,
      new RuleOnlyNarrativeGateway(),
      new DisabledNarrativeGateway(),
    );

    const result = await fallbackGateway.generateNarrative(
      makeComposeNarrativeInput({
        mode: 'LLM_ASSISTED',
      }),
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackMode).toBe('USE_RULE_SUMMARY');
    expect(result.warnings).toEqual(
      expect.arrayContaining(['fallback:upstream_error']),
    );
    expect(result.draft?.generatedBy).toBe('RULE_ONLY');
  });

  test('parser failure inside MiniMax gateway still falls back through wrapper without fatal error', async () => {
    const invalidMiniMax = new MiniMaxNarrativeGateway(makeConfig(), async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"sections":[{"code":"HEADLINE","content":"模型标题","supportingEvidenceIds":["ghost-id"]},{"code":"SHORT_SUMMARY","content":"模型摘要"}]}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const fallbackGateway = new FallbackNarrativeGateway(
      invalidMiniMax,
      new RuleOnlyNarrativeGateway(),
      new DisabledNarrativeGateway(),
    );

    const result = await fallbackGateway.generateNarrative(
      makeComposeNarrativeInput({
        mode: 'LLM_ASSISTED',
      }),
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.draft?.generatedBy).toBe('RULE_ONLY');
  });
});
