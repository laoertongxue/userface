import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type {
  SerializedNarrativeFacts,
} from '@/src/contexts/report-composition/application/dto/NarrativePromptPayload';
import { NARRATIVE_PROMPT_POLICY } from '@/src/contexts/report-composition/domain/services/NarrativePromptPolicy';
import { normalizeWhitespace, truncateText } from '@/src/shared/utils/text';

function lowData(input: ComposeNarrativeInput): boolean {
  return (
    input.portrait.tags.includes('low-data') ||
    input.stableTraits.some((trait) => trait.code === 'LOW_DATA') ||
    input.warnings.some((warning) => warning.code === 'LOW_DATA')
  );
}

export function requiresNarrativeCaveats(input: ComposeNarrativeInput): boolean {
  return input.degraded || lowData(input) || input.warnings.length > 0;
}

export class NarrativeInputSerializer {
  serialize(input: ComposeNarrativeInput): SerializedNarrativeFacts {
    const evidence = input.selectedEvidence
      .slice(0, NARRATIVE_PROMPT_POLICY.maxEvidenceItems)
      .map((item) => ({
        id: item.id,
        label: item.labelHint || item.activityType || 'evidence',
        excerpt: truncateText(normalizeWhitespace(item.excerpt), NARRATIVE_PROMPT_POLICY.maxEvidenceExcerptChars),
        community: item.community,
        publishedAt: item.publishedAt,
      }));
    const warnings = input.warnings
      .slice(0, NARRATIVE_PROMPT_POLICY.maxWarningItems)
      .map((warning) => ({
        code: warning.code,
        message: truncateText(normalizeWhitespace(warning.message), 160),
      }));
    const activeCommunities =
      input.accountCoverage?.activeCommunities.length
        ? [...input.accountCoverage.activeCommunities].sort()
        : [...new Set(input.selectedEvidence.map((item) => item.community))].sort();

    return {
      scope: {
        isCluster: (input.accountCoverage?.requestedAccounts.length ?? 1) > 1,
        accountCount:
          input.accountCoverage?.requestedAccounts.length ??
          activeCommunities.length,
        activeCommunities,
        accountCoverage: input.accountCoverage
          ? {
              requestedCount: input.accountCoverage.requestedAccounts.length,
              successfulCount: input.accountCoverage.successfulCount,
              failedCount: input.accountCoverage.failedCount,
            }
          : undefined,
      },
      portrait: {
        archetype: input.portrait.archetype,
        tags: input.portrait.tags.slice(0, 5),
        confidence: input.portrait.confidence,
        summaryFallback: normalizeWhitespace(input.portrait.summary),
      },
      traits: {
        stableTraits: input.stableTraits.map((trait) => ({
          code: trait.code,
          displayName: trait.displayName,
          confidence: trait.confidence,
          sourceCommunities: [...trait.sourceCommunities].sort(),
        })),
        communitySpecificTraits: Object.fromEntries(
          Object.entries(input.communitySpecificTraits)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([community, traits]) => [
              community,
              traits.map((trait) => ({
                code: trait.code,
                displayName: trait.displayName,
                strength: trait.strength,
                rationale: truncateText(normalizeWhitespace(trait.rationale), 140),
              })),
            ]),
        ),
        overlap: (input.overlap ?? []).map((item) => ({
          code: item.code,
          communities: [...item.communities].sort(),
          rationale: truncateText(normalizeWhitespace(item.rationale), 140),
        })),
        divergence: (input.divergence ?? []).map((item) => ({
          code: item.code,
          dominantCommunity: item.dominantCommunity,
          comparedCommunities: [...(item.comparedCommunities ?? [])].sort(),
          rationale: truncateText(normalizeWhitespace(item.rationale), 140),
        })),
      },
      evidence,
      quality: {
        degraded: input.degraded,
        lowData: lowData(input),
        warnings,
      },
      narrative: {
        mode: input.mode,
        tone: input.tone,
        audience: input.audience,
        requiresCaveats: requiresNarrativeCaveats(input),
      },
    };
  }
}
