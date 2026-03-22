import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { readNarrativeGatewayConfig, type NarrativeGatewayConfig } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import {
  NarrativeGatewayError,
  ensureNarrativeGatewayError,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import { MiniMaxNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/MiniMaxNarrativeGateway';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';

type FetchLike = typeof fetch;

export class FallbackNarrativeGateway implements LlmNarrativeGateway {
  constructor(
    readonly primaryGateway: LlmNarrativeGateway | null,
    readonly ruleOnlyGateway: LlmNarrativeGateway,
    readonly disabledGateway: LlmNarrativeGateway,
    private readonly fallbackWarning?: string,
  ) {}

  async generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    const useRuleSummary =
      input.fallbackPolicy.mode === 'USE_RULE_SUMMARY' && input.fallbackPolicy.allowRuleSummary;

    if (!this.primaryGateway) {
      const fallbackResult = useRuleSummary
        ? await this.ruleOnlyGateway.generateNarrative(input)
        : await this.disabledGateway.generateNarrative(input);

      return {
        ...fallbackResult,
        fallbackUsed: true,
        fallbackMode: input.fallbackPolicy.mode,
        warnings: [
          ...(fallbackResult.warnings ?? []),
          ...(this.fallbackWarning && input.fallbackPolicy.includeFallbackWarnings
            ? [this.fallbackWarning]
            : []),
        ],
      };
    }

    try {
      return await this.primaryGateway.generateNarrative(input);
    } catch (error) {
      const gatewayError = ensureNarrativeGatewayError(error, 'minimax');
      const fallbackResult = useRuleSummary
        ? await this.ruleOnlyGateway.generateNarrative(input)
        : await this.disabledGateway.generateNarrative(input);

      return {
        ...fallbackResult,
        fallbackUsed: true,
        fallbackMode: input.fallbackPolicy.mode,
        warnings: [
          ...(fallbackResult.warnings ?? []),
          ...(input.fallbackPolicy.includeFallbackWarnings
            ? [`fallback:${gatewayError.code.toLowerCase()}`]
            : []),
        ],
      };
    }
  }
}

type NarrativeGatewayResolverInput = {
  config?: NarrativeGatewayConfig;
  fetchImpl?: FetchLike;
};

export class NarrativeGatewayResolver {
  private readonly config: NarrativeGatewayConfig;
  private readonly fetchImpl: FetchLike;

  constructor(input: NarrativeGatewayResolverInput = {}) {
    this.config = input.config ?? readNarrativeGatewayConfig();
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  resolve(mode: NarrativeMode): LlmNarrativeGateway {
    const disabledGateway = new DisabledNarrativeGateway();
    const ruleOnlyGateway = new RuleOnlyNarrativeGateway();

    if (mode === 'OFF') {
      return disabledGateway;
    }

    if (mode === 'RULE_ONLY') {
      return ruleOnlyGateway;
    }

    if (mode !== 'LLM_ASSISTED') {
      throw NarrativeGatewayError.unsupportedProvider(mode);
    }

    if (this.config.provider !== 'minimax') {
      return new FallbackNarrativeGateway(
        null,
        ruleOnlyGateway,
        disabledGateway,
        'fallback:provider-disabled',
      );
    }

    if (!this.config.minimax.isConfigured) {
      return new FallbackNarrativeGateway(
        null,
        ruleOnlyGateway,
        disabledGateway,
        'fallback:missing-provider-config',
      );
    }

    return new FallbackNarrativeGateway(
      new MiniMaxNarrativeGateway(this.config, this.fetchImpl),
      ruleOnlyGateway,
      disabledGateway,
    );
  }
}

