import { describe, expect, test } from 'vitest';
import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { NarrativeFallbackPolicy } from '@/src/contexts/report-composition/application/dto/NarrativeFallbackPolicy';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import type { NarrativeDraft } from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import {
  narrativeGeneratedByValues,
} from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import {
  narrativeAudienceValues,
} from '@/src/contexts/report-composition/domain/value-objects/NarrativeAudience';
import {
  narrativeFallbackModeValues,
} from '@/src/contexts/report-composition/domain/value-objects/NarrativeFallbackMode';
import { narrativeModeValues } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import {
  narrativeSectionCodeValues,
} from '@/src/contexts/report-composition/domain/value-objects/NarrativeSectionCode';
import { narrativeToneValues } from '@/src/contexts/report-composition/domain/value-objects/NarrativeTone';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';

function makeFallbackPolicy(
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

function makeNarrativeInput(
  overrides: Partial<ComposeNarrativeInput> = {},
): ComposeNarrativeInput {
  const featureVector = overrides.featureVector ?? makeFeatureVector();
  const portrait = overrides.portrait ?? {
    archetype: 'discussion-oriented',
    tags: ['discussion-heavy'],
    summary: '更偏讨论参与型，活跃方式以回复互动为主。',
    confidence: makeConfidenceProfile().overall,
  };

  return {
    portrait,
    featureVector,
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
    degraded: overrides.degraded ?? featureVector.dataQuality.degraded,
    selectedEvidence:
      overrides.selectedEvidence ??
      [
        makeEvidenceCandidate({
          id: 'e1',
          activityId: 'a1',
          community: 'v2ex',
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
    fallbackPolicy: overrides.fallbackPolicy ?? makeFallbackPolicy(),
  };
}

class FakeNarrativeGateway implements LlmNarrativeGateway {
  async generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    const sections: NarrativeSection[] = [
      {
        code: 'HEADLINE',
        content: `Headline for ${input.portrait.archetype}`,
        grounded: true,
        sourceHints: ['portrait.archetype', 'portrait.tags'],
        supportingEvidenceIds: input.selectedEvidence.slice(0, 1).map((item) => item.id),
      },
      {
        code: 'SHORT_SUMMARY',
        content: input.portrait.summary,
        grounded: true,
        sourceHints: ['portrait.summary'],
      },
    ];

    const draft: NarrativeDraft = {
      mode: input.mode,
      sections,
      generatedBy: input.mode === 'LLM_ASSISTED' ? 'LLM_ASSISTED' : 'RULE_ONLY',
      audience: input.audience,
      tone: input.tone,
      warnings: input.degraded ? ['degraded-source-caution'] : [],
      metadata: {
        provider: input.mode === 'LLM_ASSISTED' ? 'fake-llm' : 'rule-only-fake',
        sectionCount: sections.length,
      },
    };

    return {
      draft,
      fallbackUsed: input.mode !== 'LLM_ASSISTED',
      fallbackMode: input.mode !== 'LLM_ASSISTED' ? input.fallbackPolicy.mode : undefined,
      warnings: draft.warnings,
    };
  }
}

describe('narrative contract', () => {
  test('narrative value-object collections stay small, explicit, and stable', () => {
    expect(narrativeModeValues).toEqual(['OFF', 'RULE_ONLY', 'LLM_ASSISTED']);
    expect(narrativeToneValues).toEqual(['NEUTRAL', 'ANALYTICAL', 'CONCISE']);
    expect(narrativeAudienceValues).toEqual(['PRODUCT_USER', 'INTERNAL_QA']);
    expect(narrativeSectionCodeValues).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
      'DEEP_SUMMARY',
      'STABLE_TRAITS',
      'COMMUNITY_SPECIFICS',
      'OVERLAP_DIVERGENCE',
      'CAVEATS',
    ]);
    expect(narrativeFallbackModeValues).toEqual(['USE_RULE_SUMMARY', 'SKIP_NARRATIVE']);
    expect(narrativeGeneratedByValues).toEqual(['RULE_ONLY', 'LLM_ASSISTED', 'NONE']);
  });

  test('NarrativeSection and NarrativeDraft support grounded, structured sections', () => {
    const sections: NarrativeSection[] = [
      {
        code: 'HEADLINE',
        content: '更偏讨论参与型',
        grounded: true,
        sourceHints: ['portrait.archetype'],
      },
      {
        code: 'SHORT_SUMMARY',
        content: '活跃方式以回复互动为主。',
        grounded: true,
        sourceHints: ['portrait.summary'],
        supportingEvidenceIds: ['e1'],
      },
      {
        code: 'CAVEATS',
        content: '当前样本有限，结论应谨慎解读。',
        grounded: true,
        sourceHints: ['warnings', 'degraded'],
      },
    ];
    const draft: NarrativeDraft = {
      mode: 'RULE_ONLY',
      sections,
      generatedBy: 'RULE_ONLY',
      audience: 'INTERNAL_QA',
      tone: 'ANALYTICAL',
      warnings: ['fallback-used'],
      metadata: {
        sectionCount: sections.length,
      },
    };

    expect(draft.sections.map((section) => section.code)).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
      'CAVEATS',
    ]);
    expect(draft.generatedBy).toBe('RULE_ONLY');
    expect(draft.audience).toBe('INTERNAL_QA');
    expect(draft.tone).toBe('ANALYTICAL');
  });

  test('ComposeNarrativeInput can be built from single-account and aggregated structured facts without raw connector data', () => {
    const single = makeNarrativeInput();
    const aggregated = makeNarrativeInput({
      featureVector: makeFeatureVector({
        activity: {
          activeCommunities: ['v2ex', 'guozaoke'],
          activeCommunityCount: 2,
        },
        community: {
          communityActivityShare: {
            guozaoke: 0.4,
            v2ex: 0.6,
          },
          perCommunityMetrics: {
            'guozaoke:beta': {
              community: 'guozaoke',
              handle: 'beta',
              totalActivities: 5,
              topicCount: 4,
              replyCount: 1,
              activeDays: 3,
              avgTextLength: 160,
              longFormRatio: 0.4,
              questionRatio: 0.1,
              linkRatio: 0.2,
            },
            'v2ex:alpha': {
              community: 'v2ex',
              handle: 'alpha',
              totalActivities: 7,
              topicCount: 2,
              replyCount: 5,
              activeDays: 4,
              avgTextLength: 120,
              longFormRatio: 0.2,
              questionRatio: 0.25,
              linkRatio: 0.05,
            },
          },
          crossCommunity: true,
        },
      }),
      stableTraits: [
        {
          code: 'DISCUSSION_HEAVY',
          displayName: 'discussion-heavy',
          confidence: 0.71,
          supportingSignals: ['DISCUSSION_HEAVY'],
          sourceCommunities: ['guozaoke', 'v2ex'],
        },
      ],
      communitySpecificTraits: {
        guozaoke: [
          {
            code: 'TOPIC_LED',
            displayName: 'topic-led',
            rationale: 'Topic creation is stronger on guozaoke.',
            strength: 0.68,
          },
        ],
        v2ex: [
          {
            code: 'DISCUSSION_HEAVY',
            displayName: 'discussion-heavy',
            rationale: 'Reply activity is stronger on v2ex.',
            strength: 0.73,
          },
        ],
      },
      overlap: [
        {
          code: 'DISCUSSION_HEAVY',
          communities: ['guozaoke', 'v2ex'],
          rationale: 'This trait appears in both communities.',
        },
      ],
      divergence: [
        {
          code: 'TOPIC_LED',
          communities: ['guozaoke'],
          dominantCommunity: 'guozaoke',
          comparedCommunities: ['v2ex'],
          rationale: 'Topic-led output is more pronounced on guozaoke.',
        },
      ],
      accountCoverage: {
        requestedAccounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
        successfulAccounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
        failedAccounts: [],
        successfulCount: 2,
        failedCount: 0,
        activeCommunities: ['guozaoke', 'v2ex'],
      },
      mode: 'LLM_ASSISTED',
      tone: 'NEUTRAL',
      audience: 'PRODUCT_USER',
    });

    expect(single.accountCoverage?.successfulCount).toBe(1);
    expect(single.mode).toBe('RULE_ONLY');
    expect(aggregated.accountCoverage?.successfulCount).toBe(2);
    expect(Object.keys(aggregated.communitySpecificTraits)).toEqual(
      expect.arrayContaining(['guozaoke', 'v2ex']),
    );
    expect(aggregated.overlap?.[0]?.code).toBe('DISCUSSION_HEAVY');
    expect(aggregated.divergence?.[0]?.dominantCommunity).toBe('guozaoke');
  });

  test('LlmNarrativeGateway contract supports fake gateways, fallbackUsed, fallbackMode, and warnings', async () => {
    const gateway = new FakeNarrativeGateway();
    const llmAssisted = await gateway.generateNarrative(
      makeNarrativeInput({
        mode: 'LLM_ASSISTED',
        tone: 'CONCISE',
        audience: 'PRODUCT_USER',
      }),
    );
    const fallback = await gateway.generateNarrative(
      makeNarrativeInput({
        mode: 'RULE_ONLY',
        degraded: true,
        fallbackPolicy: makeFallbackPolicy({
          mode: 'USE_RULE_SUMMARY',
        }),
      }),
    );

    expect(llmAssisted.fallbackUsed).toBe(false);
    expect(llmAssisted.draft).toMatchObject({
      generatedBy: 'LLM_ASSISTED',
      audience: 'PRODUCT_USER',
      tone: 'CONCISE',
    });

    expect(fallback.fallbackUsed).toBe(true);
    expect(fallback.fallbackMode).toBe('USE_RULE_SUMMARY');
    expect(fallback.warnings).toEqual(['degraded-source-caution']);
    expect(fallback.draft?.sections.map((section) => section.code)).toEqual([
      'HEADLINE',
      'SHORT_SUMMARY',
    ]);
  });
});

