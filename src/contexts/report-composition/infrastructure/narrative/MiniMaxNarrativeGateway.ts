import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import { NarrativePromptBuilder } from '@/src/contexts/report-composition/domain/services/NarrativePromptBuilder';
import type { NarrativeGatewayConfig } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import {
  NarrativeGatewayError,
  ensureNarrativeGatewayError,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import { NarrativeResponseParser } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeResponseParser';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

type FetchLike = typeof fetch;

type MiniMaxChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

function extractChoiceContent(payload: MiniMaxChatResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  return '';
}

export class MiniMaxNarrativeGateway implements LlmNarrativeGateway {
  constructor(
    private readonly config: NarrativeGatewayConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly promptBuilder: NarrativePromptBuilder = new NarrativePromptBuilder(),
    private readonly responseParser: NarrativeResponseParser = new NarrativeResponseParser(),
  ) {}

  async generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    const observability = input.observability?.child('narrative.generate.minimax');
    const span = observability?.startSpan('narrative.generate.minimax');

    if (!this.config.minimax.isConfigured) {
      throw NarrativeGatewayError.config(
        'MiniMax narrative provider requires API key, base URL, and model.',
        'minimax',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      observability?.logger.event(observabilityEvents.narrativeGenerateStarted, {
        message: 'MiniMax narrative generation started.',
        context: {
          provider: 'minimax',
          mode: input.mode,
        },
      });
      const promptPayload = this.promptBuilder.build(input);
      const response = await this.fetchImpl(
        `${this.config.minimax.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.minimax.apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.config.minimax.model,
            messages: promptPayload.messages,
            temperature: 0.2,
          }),
        },
      );

      if (response.status === 429) {
        throw NarrativeGatewayError.rateLimited('minimax', 429);
      }

      if (!response.ok) {
        throw NarrativeGatewayError.upstream('minimax', response.status);
      }

      const payload = (await response.json()) as MiniMaxChatResponse;
      const content = extractChoiceContent(payload);

      if (!content) {
        throw NarrativeGatewayError.invalidResponse(
          'MiniMax response did not include narrative content.',
          'minimax',
        );
      }

      const result = {
        draft: this.responseParser.parse(content, input),
        fallbackUsed: false,
        warnings: [],
      } satisfies NarrativeGenerationResult;
      const completedSpan = span?.finish('success');
      observability?.logger.event(observabilityEvents.narrativeGenerateCompleted, {
        message: 'MiniMax narrative generation completed.',
        context: {
          provider: 'minimax',
          mode: input.mode,
          sectionCount: result.draft?.sections.length ?? 0,
          durationMs: completedSpan?.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.narrativeGenerateTotal, 1, {
        provider: 'minimax',
        mode: input.mode,
        outcome: 'success',
      });
      if (completedSpan) {
        observability?.metrics.timing(metricNames.narrativeGenerateDurationMs, completedSpan.durationMs, {
          provider: 'minimax',
          mode: input.mode,
          outcome: 'success',
        });
      }

      return result;
    } catch (error) {
      const gatewayError = ensureNarrativeGatewayError(error, 'minimax');
      const failedSpan = span?.finish('failure');

      observability?.logger.event(observabilityEvents.narrativeGenerateFailed, {
        level: 'error',
        message: 'MiniMax narrative generation failed.',
        errorCode: normalizeErrorCode({ error: gatewayError }),
        context: {
          provider: 'minimax',
          mode: input.mode,
          durationMs: failedSpan?.durationMs,
          gatewayCode: gatewayError.code,
        },
      });
      observability?.metrics.counter(metricNames.narrativeGenerateTotal, 1, {
        provider: 'minimax',
        mode: input.mode,
        outcome: 'failure',
      });
      if (failedSpan) {
        observability?.metrics.timing(metricNames.narrativeGenerateDurationMs, failedSpan.durationMs, {
          provider: 'minimax',
          mode: input.mode,
          outcome: 'failure',
        });
      }
      if (gatewayError.code === 'INVALID_RESPONSE') {
        observability?.metrics.counter(metricNames.narrativeInvalidResponseTotal, 1, {
          provider: 'minimax',
          mode: input.mode,
        });
      }

      throw gatewayError;
    } finally {
      clearTimeout(timeout);
    }
  }
}
