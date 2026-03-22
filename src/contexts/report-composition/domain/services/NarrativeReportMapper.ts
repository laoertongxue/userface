import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type {
  ComposePortraitReportInput,
  ComposePortraitReportNarrativeOptions,
} from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import type {
  PortraitNarrative,
} from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import { narrativeSectionCodeValues } from '@/src/contexts/report-composition/domain/value-objects/NarrativeSectionCode';
import {
  buildFallbackCaveat,
  resolveNarrativeOptions,
  resolvePortraitTags,
} from '@/src/contexts/report-composition/domain/services/NarrativeReportPolicy';
import { normalizeWhitespace } from '@/src/shared/utils/text';

type NarrativeMappingInput = {
  input: ComposePortraitReportInput;
  defaultSummary: string;
  narrativeOptions?: Partial<ComposePortraitReportNarrativeOptions>;
  narrativeResult?: NarrativeGenerationResult;
};

type NarrativeMappingResult = {
  summary: string;
  narrative?: PortraitNarrative;
};

function canonicalSectionOrder(code: NarrativeSection['code']): number {
  return narrativeSectionCodeValues.indexOf(code);
}

function dedupeAndSortStrings(values?: string[]): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSection(section: NarrativeSection): NarrativeSection | null {
  const content = normalizeWhitespace(section.content);

  if (!content) {
    return null;
  }

  return {
    ...section,
    content,
    sourceHints: dedupeAndSortStrings(section.sourceHints),
    supportingEvidenceIds: dedupeAndSortStrings(section.supportingEvidenceIds),
  };
}

function normalizeSections(sections: NarrativeSection[]): NarrativeSection[] {
  const deduped = new Map<NarrativeSection['code'], NarrativeSection>();

  for (const section of sections) {
    const normalized = normalizeSection(section);

    if (!normalized || deduped.has(normalized.code)) {
      continue;
    }

    deduped.set(normalized.code, normalized);
  }

  return [...deduped.values()].sort(
    (left, right) => canonicalSectionOrder(left.code) - canonicalSectionOrder(right.code),
  );
}

function sectionContent(
  sections: NarrativeSection[],
  code: NarrativeSection['code'],
): string | undefined {
  return sections.find((section) => section.code === code)?.content;
}

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)].sort((left, right) => left.localeCompare(right));
}

export class NarrativeReportMapper {
  map({
    input,
    defaultSummary,
    narrativeOptions,
    narrativeResult,
  }: NarrativeMappingInput): NarrativeMappingResult {
    const resolvedOptions = resolveNarrativeOptions(narrativeOptions);
    const portraitTags = resolvePortraitTags(input.tags);
    const fallbackCaveat = buildFallbackCaveat(input, portraitTags);
    const draft = narrativeResult?.draft ?? null;
    const sections = normalizeSections(draft?.sections ?? []);
    const shortSummary = sectionContent(sections, 'SHORT_SUMMARY');
    const headline = sectionContent(sections, 'HEADLINE');
    const caveats = sectionContent(sections, 'CAVEATS') ?? fallbackCaveat;
    const warnings = dedupeWarnings([
      ...(draft?.warnings ?? []),
      ...(narrativeResult?.warnings ?? []),
    ].filter(Boolean));
    const shouldIncludeNarrative =
      resolvedOptions.mode !== 'OFF' ||
      draft !== null ||
      warnings.length > 0;

    return {
      summary: shortSummary ?? defaultSummary,
      narrative: shouldIncludeNarrative
        ? {
            generatedBy: draft?.generatedBy ?? 'NONE',
            fallbackUsed: narrativeResult?.fallbackUsed ?? false,
            mode: draft?.mode ?? resolvedOptions.mode,
            tone: draft?.tone ?? resolvedOptions.tone,
            audience: draft?.audience ?? resolvedOptions.audience,
            headline,
            shortSummary,
            deepSummary: sectionContent(sections, 'DEEP_SUMMARY'),
            stableTraitsSummary: sectionContent(sections, 'STABLE_TRAITS'),
            communitySpecificSummary: sectionContent(sections, 'COMMUNITY_SPECIFICS'),
            overlapDivergenceSummary: sectionContent(sections, 'OVERLAP_DIVERGENCE'),
            caveats,
            sections: sections.length > 0 ? sections : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
          }
        : undefined,
    };
  }
}
