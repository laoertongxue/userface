import { describe, expect, test } from 'vitest';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { MiniMaxNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/MiniMaxNarrativeGateway';
import { NarrativeGatewayError } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import {
  FallbackNarrativeGateway,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { readNarrativeGatewayConfig } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import { NarrativeResponseParser } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeResponseParser';
import { narrativeGoldenCases } from '@/src/contexts/report-composition/__tests__/regression/narrative/goldenCases';

function makeConfig() {
  return readNarrativeGatewayConfig({
    NARRATIVE_PROVIDER: 'minimax',
    NARRATIVE_TIMEOUT_MS: 1500,
    MINIMAX_API_KEY: 'key',
    MINIMAX_BASE_URL: 'https://api.minimax.example/v1',
    MINIMAX_MODEL: 'abab-1.0-chat',
  });
}

describe('Stage 5 narrative gateway regression', () => {
  test('parses a stable llm-assisted single-account response', async () => {
    const responseText = narrativeGoldenCases.llmAssistedSingleAccount.providerOutput!;
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: responseText,
              },
            },
          ],
        }),
        { status: 200 },
      );

    const result = await new MiniMaxNarrativeGateway(makeConfig(), fetchImpl).generateNarrative(
      narrativeGoldenCases.llmAssistedSingleAccount.narrativeInput!,
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.draft?.generatedBy).toBe('LLM_ASSISTED');
    expect(result.draft?.sections.map((section) => section.code)).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
      'DEEP_SUMMARY',
    ]);
  });

  test('rejects parser-invalid-output deterministically', () => {
    const parser = new NarrativeResponseParser();

    expect(() =>
      parser.parse(
        narrativeGoldenCases.parserInvalidOutput.providerOutput!,
        narrativeGoldenCases.parserInvalidOutput.narrativeInput!,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_RESPONSE',
      } satisfies Partial<NarrativeGatewayError>),
    );
  });

  test('rejects missing caveat when degraded input requires it', () => {
    const parser = new NarrativeResponseParser();

    expect(() =>
      parser.parse(
        narrativeGoldenCases.missingCaveatInDegraded.providerOutput!,
        narrativeGoldenCases.missingCaveatInDegraded.narrativeInput!,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_RESPONSE',
      } satisfies Partial<NarrativeGatewayError>),
    );
  });

  test('falls back to rule-only on provider timeout without fatal error', async () => {
    const timeoutGateway = new MiniMaxNarrativeGateway(makeConfig(), async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    const gateway = new FallbackNarrativeGateway(
      timeoutGateway,
      new RuleOnlyNarrativeGateway(),
      new DisabledNarrativeGateway(),
    );

    const result = await gateway.generateNarrative(
      narrativeGoldenCases.providerTimeout.narrativeInput!,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackMode).toBe('USE_RULE_SUMMARY');
    expect(result.warnings).toEqual(expect.arrayContaining(['fallback:timeout']));
    expect(result.draft?.generatedBy).toBe('RULE_ONLY');
  });

  test('falls back to rule-only on upstream error without losing degraded caveats', async () => {
    const upstreamGateway = new MiniMaxNarrativeGateway(makeConfig(), async () =>
      new Response('upstream error', { status: 503 }),
    );
    const gateway = new FallbackNarrativeGateway(
      upstreamGateway,
      new RuleOnlyNarrativeGateway(),
      new DisabledNarrativeGateway(),
    );

    const result = await gateway.generateNarrative(
      narrativeGoldenCases.degradedSource.narrativeInput!,
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.draft?.generatedBy).toBe('RULE_ONLY');
    expect(result.draft?.sections.some((section) => section.code === 'CAVEATS')).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining(['fallback:upstream_error']));
  });
});
