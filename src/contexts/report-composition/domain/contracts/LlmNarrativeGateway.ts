import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';

export interface LlmNarrativeGateway {
  generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult>;
}

