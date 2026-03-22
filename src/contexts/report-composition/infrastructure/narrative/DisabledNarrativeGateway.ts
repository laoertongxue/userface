import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';

export class DisabledNarrativeGateway implements LlmNarrativeGateway {
  async generateNarrative(_input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    return {
      draft: null,
      fallbackUsed: false,
      warnings: [],
    };
  }
}

