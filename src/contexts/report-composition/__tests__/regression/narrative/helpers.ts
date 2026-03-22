import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import type { NarrativeDraft } from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import { makeNarrativeFallbackPolicy } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';

export class StaticNarrativeGateway implements LlmNarrativeGateway {
  constructor(private readonly result: NarrativeGenerationResult) {}

  async generateNarrative(_input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    return this.result;
  }
}

export class FailingNarrativeGateway implements LlmNarrativeGateway {
  constructor(private readonly error: unknown = new Error('upstream failure')) {}

  async generateNarrative(_input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    throw this.error;
  }
}

export function makeResolver(gateway: LlmNarrativeGateway) {
  return {
    resolve() {
      return gateway;
    },
  };
}

export function makeNarrativeResult(
  sections: NarrativeSection[],
  overrides: Partial<NarrativeGenerationResult> & {
    mode?: NarrativeDraft['mode'];
    generatedBy?: NarrativeDraft['generatedBy'];
    tone?: NarrativeDraft['tone'];
    audience?: NarrativeDraft['audience'];
    draftWarnings?: string[];
  } = {},
): NarrativeGenerationResult {
  return {
    draft: {
      mode: overrides.mode ?? 'LLM_ASSISTED',
      generatedBy: overrides.generatedBy ?? 'LLM_ASSISTED',
      tone: overrides.tone ?? 'CONCISE',
      audience: overrides.audience ?? 'PRODUCT_USER',
      warnings: overrides.draftWarnings ?? [],
      sections,
      metadata: {
        provider: overrides.generatedBy === 'RULE_ONLY' ? 'rule-only' : 'minimax',
        sectionCount: sections.length,
      },
    },
    fallbackUsed: overrides.fallbackUsed ?? false,
    fallbackMode: overrides.fallbackMode,
    warnings: overrides.warnings ?? [],
  };
}

export function makeStructuredOutput(
  sections: Array<{
    code: NarrativeSection['code'];
    content: string;
    sourceHints?: string[];
    supportingEvidenceIds?: string[];
  }>,
): string {
  return JSON.stringify({ sections });
}

export function makeComposePortraitReportInput(
  overrides: Partial<ComposePortraitReportInput> = {},
): ComposePortraitReportInput {
  const identityCluster =
    overrides.identityCluster ??
    createIdentityCluster({
      accounts: [
        {
          community: 'v2ex',
          handle: 'alpha',
        },
      ],
      mode: 'SINGLE_ACCOUNT',
      now: '2026-03-22T00:00:00.000Z',
    });
  const accounts = identityCluster.accounts;
  const activeCommunities = [...new Set(accounts.map((account) => account.community))].sort();
  const perCommunityMetrics = Object.fromEntries(
    accounts.map((account, index) => [
      `${account.community}:${account.handle}`,
      {
        community: account.community,
        handle: account.handle,
        totalActivities: 12,
        topicCount: index % 2 === 0 ? 5 : 7,
        replyCount: index % 2 === 0 ? 7 : 5,
        activeDays: 5,
        avgTextLength: 120,
        longFormRatio: 0.25,
        questionRatio: 0.18,
        linkRatio: 0.08,
      },
    ]),
  );
  const featureVector =
    overrides.featureVector ??
    makeFeatureVector({
      activity: {
        activeCommunities,
        activeCommunityCount: activeCommunities.length,
      },
      community: {
        crossCommunity: activeCommunities.length > 1,
        perCommunityMetrics,
        communityActivityShare: Object.fromEntries(
          activeCommunities.map((community) => [community, 1 / activeCommunities.length]),
        ),
      },
    });
  const selectedEvidence =
    overrides.selectedEvidence ??
    [
      makeEvidenceCandidate({
        id: 'e1',
        activityId: 'a1',
        community: accounts[0]?.community ?? 'v2ex',
        activityType: 'reply',
        excerpt: 'A representative reply with enough detail to be useful in the report.',
        activityUrl: 'https://example.com/t/1',
        reasons: ['substantive-text', 'type-balance'],
      }),
    ];
  const clusterMergeResult =
    overrides.clusterMergeResult ??
    {
      mergedActivities: [],
      perAccountProfiles: accounts.map((account) => ({
        account,
        profile: {
          community: account.community,
          handle: account.handle,
          displayName: account.displayName ?? account.handle,
          stats: {},
        },
      })),
      perAccountWarnings: accounts.map((account) => ({
        account,
        warnings: [],
        degraded: false,
        successful: true,
      })),
      clusterWarnings: [],
      degraded: false,
      successfulAccountCount: accounts.length,
      failedAccountCount: 0,
      activeCommunities,
    };
  const fetchResult =
    overrides.fetchResult ??
    {
      identityCluster,
      successfulSnapshots: [],
      failedAccounts: [],
      totalAccounts: accounts.length,
      successfulCount: accounts.length,
      failedCount: 0,
      degraded: false,
    };
  const tags =
    overrides.tags ??
    [
      {
        code: 'DISCUSSION_HEAVY',
        displayName: 'discussion-heavy',
        summaryHint: 'Reply activity is a primary participation pattern.',
        supportingSignalCodes: ['DISCUSSION_HEAVY'],
      },
    ];
  const synthesisResult =
    overrides.synthesisResult ??
    {
      stableTraits: tags.slice(0, 1).map((tag) => tag.code),
      communityInsights: accounts.map((account) => ({
        community: account.community,
        handle: account.handle,
        dominantTraits: tags.slice(0, 1).map((tag) => tag.code),
        summaryHint: `Observed 12 activities on ${account.community} with a reply-led pattern.`,
        confidenceModifier: 0.74,
      })),
    };

  return {
    archetype: overrides.archetype ?? 'DISCUSSION_ORIENTED',
    confidenceProfile: overrides.confidenceProfile ?? makeConfidenceProfile(),
    evidenceCandidates: overrides.evidenceCandidates ?? selectedEvidence,
    featureVector,
    fetchResult,
    identityCluster,
    primaryArchetype: overrides.primaryArchetype ?? {
      code: 'DISCUSSION_ORIENTED',
      score: 0.72,
      rationale: 'Replies are a strong and sustained pattern in the sample.',
      supportingSignalCodes: ['DISCUSSION_HEAVY'],
    },
    selectedEvidence,
    signals:
      overrides.signals ??
      [
        makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.78 }),
      ],
    synthesisResult,
    tags,
    warnings: overrides.warnings ?? [],
    clusterMergeResult,
    narrative:
      overrides.narrative ?? {
        mode: 'RULE_ONLY',
        tone: 'ANALYTICAL',
        audience: 'INTERNAL_QA',
        fallbackPolicy: makeNarrativeFallbackPolicy(),
      },
  };
}
