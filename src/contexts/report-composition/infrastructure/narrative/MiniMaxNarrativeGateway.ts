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
    if (!this.config.minimax.isConfigured) {
      throw NarrativeGatewayError.config(
        'MiniMax narrative provider requires API key, base URL, and model.',
        'minimax',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
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

      return {
        draft: this.responseParser.parse(content, input),
        fallbackUsed: false,
        warnings: [],
      };
    } catch (error) {
      throw ensureNarrativeGatewayError(error, 'minimax');
    } finally {
      clearTimeout(timeout);
    }
  }
}
