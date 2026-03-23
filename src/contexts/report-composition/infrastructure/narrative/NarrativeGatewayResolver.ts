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
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

type FetchLike = typeof fetch;

export class FallbackNarrativeGateway implements LlmNarrativeGateway {
  constructor(
    readonly primaryGateway: LlmNarrativeGateway | null,
    readonly ruleOnlyGateway: LlmNarrativeGateway,
    readonly disabledGateway: LlmNarrativeGateway,
    private readonly fallbackWarning?: string,
  ) {}

  async generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    const observability = input.observability?.child('narrative.fallback');
    const useRuleSummary =
      input.fallbackPolicy.mode === 'USE_RULE_SUMMARY' && input.fallbackPolicy.allowRuleSummary;

    if (!this.primaryGateway) {
      const fallbackResult = useRuleSummary
        ? await this.ruleOnlyGateway.generateNarrative(input)
        : await this.disabledGateway.generateNarrative(input);

      const result = {
        ...fallbackResult,
        fallbackUsed: true,
        fallbackMode: input.fallbackPolicy.mode,
        warnings: [
          ...(fallbackResult.warnings ?? []),
          ...(this.fallbackWarning && input.fallbackPolicy.includeFallbackWarnings
            ? [this.fallbackWarning]
            : []),
        ],
      } satisfies NarrativeGenerationResult;
      observability?.logger.event(observabilityEvents.narrativeFallbackUsed, {
        level: 'warn',
        message: 'Narrative generation used fallback because the primary provider was unavailable.',
        errorCode: normalizeErrorCode({ fallbackUsed: true }),
        context: {
          mode: input.mode,
          fallbackMode: input.fallbackPolicy.mode,
          provider: 'none',
          generatedBy: result.draft?.generatedBy ?? 'NONE',
        },
      });
      observability?.metrics.counter(metricNames.narrativeFallbackTotal, 1, {
        mode: input.mode,
        provider: 'none',
        fallbackMode: input.fallbackPolicy.mode,
      });

      return result;
    }

    try {
      return await this.primaryGateway.generateNarrative(input);
    } catch (error) {
      const gatewayError = ensureNarrativeGatewayError(error, 'minimax');
      const fallbackResult = useRuleSummary
        ? await this.ruleOnlyGateway.generateNarrative(input)
        : await this.disabledGateway.generateNarrative(input);

      const result = {
        ...fallbackResult,
        fallbackUsed: true,
        fallbackMode: input.fallbackPolicy.mode,
        warnings: [
          ...(fallbackResult.warnings ?? []),
          ...(input.fallbackPolicy.includeFallbackWarnings
            ? [`fallback:${gatewayError.code.toLowerCase()}`]
            : []),
        ],
      } satisfies NarrativeGenerationResult;
      observability?.logger.event(observabilityEvents.narrativeFallbackUsed, {
        level: 'warn',
        message: 'Narrative generation fell back after primary provider failure.',
        errorCode: normalizeErrorCode({ fallbackUsed: true }),
        context: {
          mode: input.mode,
          fallbackMode: input.fallbackPolicy.mode,
          provider: gatewayError.provider ?? 'minimax',
          gatewayCode: gatewayError.code,
          generatedBy: result.draft?.generatedBy ?? 'NONE',
        },
      });
      observability?.metrics.counter(metricNames.narrativeFallbackTotal, 1, {
        mode: input.mode,
        provider: gatewayError.provider ?? 'minimax',
        fallbackMode: input.fallbackPolicy.mode,
      });

      return result;
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
