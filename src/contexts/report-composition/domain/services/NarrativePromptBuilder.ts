import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type {
  NarrativePromptPayload,
} from '@/src/contexts/report-composition/application/dto/NarrativePromptPayload';
import { NARRATIVE_PROMPT_POLICY } from '@/src/contexts/report-composition/domain/services/NarrativePromptPolicy';
import {
  NarrativeInputSerializer,
  requiresNarrativeCaveats,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeInputSerializer';

export class NarrativePromptBuilder {
  constructor(
    private readonly serializer: NarrativeInputSerializer = new NarrativeInputSerializer(),
  ) {}

  build(input: ComposeNarrativeInput): NarrativePromptPayload {
    const facts = this.serializer.serialize(input);
    const requiresCaveats = requiresNarrativeCaveats(input);

    return {
      facts,
      requiresCaveats,
      messages: [
        {
          role: 'system',
          content: NARRATIVE_PROMPT_POLICY.systemInstruction,
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: NARRATIVE_PROMPT_POLICY.taskInstruction,
            requiredSections: NARRATIVE_PROMPT_POLICY.requiredSections,
            requiresCaveats,
            facts,
          }),
        },
      ],
    };
  }
}

