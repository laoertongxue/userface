import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeFallbackPolicy } from '@/src/contexts/report-composition/application/dto/NarrativeFallbackPolicy';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';

export function makeNarrativeFallbackPolicy(
  overrides: Partial<NarrativeFallbackPolicy> = {},
): NarrativeFallbackPolicy {
  return {
    mode: 'USE_RULE_SUMMARY',
    allowRuleSummary: true,
    allowEmptyDraft: false,
    includeFallbackWarnings: true,
    ...overrides,
  };
}

export function makeComposeNarrativeInput(
  overrides: Partial<ComposeNarrativeInput> = {},
): ComposeNarrativeInput {
  return {
    portrait: overrides.portrait ?? {
      archetype: 'discussion-oriented',
      tags: ['discussion-heavy'],
      summary: '更偏讨论参与型，活跃方式以回复互动为主。',
      confidence: makeConfidenceProfile().overall,
    },
    featureVector: overrides.featureVector ?? makeFeatureVector(),
    signals: overrides.signals ?? [makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.78 })],
    stableTraits:
      overrides.stableTraits ??
      [
        {
          code: 'DISCUSSION_HEAVY',
          displayName: 'discussion-heavy',
          confidence: 0.78,
          supportingSignals: ['DISCUSSION_HEAVY'],
          sourceCommunities: ['v2ex'],
        },
      ],
    communitySpecificTraits:
      overrides.communitySpecificTraits ??
      {
        v2ex: [
          {
            code: 'DISCUSSION_HEAVY',
            displayName: 'discussion-heavy',
            rationale: 'Reply activity is the stronger community-specific pattern.',
            strength: 0.78,
          },
        ],
      },
    overlap: overrides.overlap ?? [],
    divergence: overrides.divergence ?? [],
    warnings: overrides.warnings ?? [],
    degraded: overrides.degraded ?? false,
    selectedEvidence:
      overrides.selectedEvidence ??
      [
        makeEvidenceCandidate({
          id: 'e1',
          activityId: 'a1',
          reasons: ['substantive-text'],
        }),
      ],
    accountCoverage:
      overrides.accountCoverage ??
      {
        requestedAccounts: [{ community: 'v2ex', handle: 'alpha' }],
        successfulAccounts: [{ community: 'v2ex', handle: 'alpha' }],
        failedAccounts: [],
        successfulCount: 1,
        failedCount: 0,
        activeCommunities: ['v2ex'],
      },
    mode: overrides.mode ?? 'RULE_ONLY',
    tone: overrides.tone ?? 'ANALYTICAL',
    audience: overrides.audience ?? 'INTERNAL_QA',
    fallbackPolicy: overrides.fallbackPolicy ?? makeNarrativeFallbackPolicy(),
  };
}

