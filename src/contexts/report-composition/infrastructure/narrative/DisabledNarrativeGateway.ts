import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

export class DisabledNarrativeGateway implements LlmNarrativeGateway {
  async generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    const observability = input.observability?.child('narrative.generate.disabled');
    const span = observability?.startSpan('narrative.generate.disabled');
    const result = {
      draft: null,
      fallbackUsed: false,
      warnings: [],
    } satisfies NarrativeGenerationResult;
    const completedSpan = span?.finish('success');
    observability?.logger.event(observabilityEvents.narrativeGenerateCompleted, {
      message: 'Narrative generation skipped because narrative mode is OFF.',
      context: {
        provider: 'disabled',
        mode: input.mode,
        durationMs: completedSpan?.durationMs,
      },
    });
    observability?.metrics.counter(metricNames.narrativeGenerateTotal, 1, {
      provider: 'disabled',
      mode: input.mode,
      outcome: 'success',
    });
    if (completedSpan) {
      observability?.metrics.timing(metricNames.narrativeGenerateDurationMs, completedSpan.durationMs, {
        provider: 'disabled',
        mode: input.mode,
        outcome: 'success',
      });
    }

    return result;
  }
}
