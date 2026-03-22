import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeStructuredOutput } from '@/src/contexts/report-composition/application/dto/NarrativeStructuredOutput';
import type { NarrativeDraft } from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import { NARRATIVE_PROMPT_POLICY } from '@/src/contexts/report-composition/domain/services/NarrativePromptPolicy';
import { NarrativeGatewayError } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import { requiresNarrativeCaveats } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeInputSerializer';
import { narrativeStructuredOutputSchema } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeResponseSchema';
import { normalizeWhitespace } from '@/src/shared/utils/text';

function stripMarkdownFence(input: string): string {
  const trimmed = input.trim();

  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\s*/u, '')
    .replace(/\s*```$/u, '')
    .trim();
}

function canonicalSectionOrder(code: NarrativeSection['code']): number {
  return narrativeStructuredOutputSchema.shape.sections.element.shape.code.options.indexOf(code);
}

function hasMeaningfulCommunitySpecifics(input: ComposeNarrativeInput): boolean {
  return Object.values(input.communitySpecificTraits).some((traits) => traits.length > 0);
}

function hasMeaningfulOverlapOrDivergence(input: ComposeNarrativeInput): boolean {
  return (input.overlap?.length ?? 0) > 0 || (input.divergence?.length ?? 0) > 0;
}

function normalizeSections(
  parsed: NarrativeStructuredOutput,
  input: ComposeNarrativeInput,
): NarrativeSection[] {
  const validEvidenceIds = new Set(input.selectedEvidence.map((item) => item.id));
  const deduped = new Map<NarrativeSection['code'], NarrativeSection>();

  for (const section of parsed.sections) {
    const content = normalizeWhitespace(section.content);
    const supportingEvidenceIds = section.supportingEvidenceIds ?? [];

    if (!content) {
      continue;
    }

    if (
      supportingEvidenceIds.some((evidenceId) => !validEvidenceIds.has(evidenceId))
    ) {
      throw NarrativeGatewayError.invalidResponse(
        `Narrative section ${section.code} referenced unknown evidence ids.`,
        'minimax',
      );
    }

    if (section.code === 'OVERLAP_DIVERGENCE' && !hasMeaningfulOverlapOrDivergence(input)) {
      throw NarrativeGatewayError.invalidResponse(
        'Narrative output included overlap/divergence without matching facts.',
        'minimax',
      );
    }

    if (section.code === 'COMMUNITY_SPECIFICS' && !hasMeaningfulCommunitySpecifics(input)) {
      throw NarrativeGatewayError.invalidResponse(
        'Narrative output included community-specifics without matching facts.',
        'minimax',
      );
    }

    if (!deduped.has(section.code)) {
      deduped.set(section.code, {
        code: section.code,
        content,
        grounded: true,
        sourceHints: section.sourceHints,
        supportingEvidenceIds,
      });
    }
  }

  const sections = [...deduped.values()].sort(
    (left, right) => canonicalSectionOrder(left.code) - canonicalSectionOrder(right.code),
  );

  const sectionCodes = new Set(sections.map((section) => section.code));

  for (const requiredCode of NARRATIVE_PROMPT_POLICY.requiredSections) {
    if (!sectionCodes.has(requiredCode)) {
      throw NarrativeGatewayError.invalidResponse(
        `Narrative output is missing required section ${requiredCode}.`,
        'minimax',
      );
    }
  }

  if (requiresNarrativeCaveats(input) && !sectionCodes.has(NARRATIVE_PROMPT_POLICY.cautionSectionCode)) {
    throw NarrativeGatewayError.invalidResponse(
      'Narrative output must include CAVEATS for degraded or low-data input.',
      'minimax',
    );
  }

  return sections;
}

export class NarrativeResponseParser {
  parse(raw: string, input: ComposeNarrativeInput): NarrativeDraft {
    const cleaned = stripMarkdownFence(raw);
    let parsed: unknown;

    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      throw NarrativeGatewayError.invalidResponse(
        'Narrative provider returned invalid JSON.',
        'minimax',
        error,
      );
    }

    const output = narrativeStructuredOutputSchema.safeParse(parsed);

    if (!output.success) {
      throw NarrativeGatewayError.invalidResponse(
        'Narrative JSON does not match the structured output schema.',
        'minimax',
        output.error,
      );
    }

    const sections = normalizeSections(output.data, input);

    return {
      mode: input.mode,
      sections,
      generatedBy: 'LLM_ASSISTED',
      audience: input.audience,
      tone: input.tone,
      warnings: [],
      metadata: {
        provider: 'minimax',
        sectionCount: sections.length,
      },
    };
  }
}
