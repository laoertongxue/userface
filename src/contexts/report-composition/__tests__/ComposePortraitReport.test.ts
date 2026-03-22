import { describe, expect, test } from 'vitest';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import {
  FallbackNarrativeGateway,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';
import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';

class StaticNarrativeGateway implements LlmNarrativeGateway {
  constructor(private readonly result: NarrativeGenerationResult) {}

  async generateNarrative(_input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    return this.result;
  }
}

class FailingNarrativeGateway implements LlmNarrativeGateway {
  async generateNarrative(_input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    throw new Error('upstream failure');
  }
}

function makeInput(overrides: Partial<ComposePortraitReportInput> = {}): ComposePortraitReportInput {
  return {
    archetype: overrides.archetype ?? 'DISCUSSION_ORIENTED',
    clusterMergeResult:
      overrides.clusterMergeResult ?? {
        mergedActivities: [],
        perAccountProfiles: [
          {
            account: {
              community: 'v2ex',
              handle: 'alpha',
            },
            profile: {
              community: 'v2ex',
              handle: 'alpha',
              displayName: 'alpha',
              stats: {},
            },
          },
        ],
        perAccountWarnings: [
          {
            account: {
              community: 'v2ex',
              handle: 'alpha',
            },
            warnings: [],
            degraded: false,
            successful: true,
          },
        ],
        clusterWarnings: [],
        degraded: false,
        successfulAccountCount: 1,
        failedAccountCount: 0,
        activeCommunities: ['v2ex'],
      },
    confidenceProfile: overrides.confidenceProfile ?? makeConfidenceProfile(),
    evidenceCandidates:
      overrides.evidenceCandidates ??
      [
        makeEvidenceCandidate({
          id: 'e1',
          activityId: 'a1',
          activityType: 'reply',
          excerpt: 'A representative reply with enough detail to be useful in the report.',
          activityUrl: 'https://example.com/t/1',
          reasons: ['substantive-text', 'type-balance'],
        }),
      ],
    featureVector: overrides.featureVector ?? makeFeatureVector(),
    fetchResult:
      overrides.fetchResult ?? {
        identityCluster: createIdentityCluster({
          accounts: [
            {
              community: 'v2ex',
              handle: 'alpha',
            },
          ],
          mode: 'SINGLE_ACCOUNT',
          now: '2026-03-22T00:00:00.000Z',
        }),
        successfulSnapshots: [],
        failedAccounts: [],
        totalAccounts: 1,
        successfulCount: 1,
        failedCount: 0,
        degraded: false,
      },
    identityCluster:
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
      }),
    primaryArchetype: overrides.primaryArchetype ?? {
      code: 'DISCUSSION_ORIENTED',
      score: 0.72,
      rationale: 'Replies are a strong and sustained pattern in the sample.',
      supportingSignalCodes: ['DISCUSSION_HEAVY'],
    },
    selectedEvidence:
      overrides.selectedEvidence ??
      [
        makeEvidenceCandidate({
          id: 'e1',
          activityId: 'a1',
          activityType: 'reply',
          excerpt: 'A representative reply with enough detail to be useful in the report.',
          activityUrl: 'https://example.com/t/1',
          reasons: ['substantive-text', 'type-balance'],
        }),
      ],
    signals:
      overrides.signals ??
      [
        makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.78 }),
      ],
    synthesisResult: overrides.synthesisResult ?? {
      stableTraits: ['DISCUSSION_HEAVY'],
      communityInsights: [
        {
          community: 'v2ex',
          handle: 'alpha',
          dominantTraits: ['DISCUSSION_HEAVY'],
          summaryHint: 'Observed 12 activities on v2ex with a reply-led pattern.',
          confidenceModifier: 0.74,
        },
      ],
    },
    tags:
      overrides.tags ??
      [
        {
          code: 'DISCUSSION_HEAVY',
          displayName: 'discussion-heavy',
          summaryHint: 'Reply activity is a primary participation pattern.',
          supportingSignalCodes: ['DISCUSSION_HEAVY'],
        },
      ],
    warnings: overrides.warnings ?? [],
    narrative: overrides.narrative,
  };
}

function makeResolver(gateway: LlmNarrativeGateway) {
  return {
    resolve() {
      return gateway;
    },
  };
}

describe('ComposePortraitReport narrative integration', () => {
  test('keeps report compatible when narrative mode is OFF', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new DisabledNarrativeGateway()),
    ).execute(
      makeInput({
        narrative: {
          mode: 'OFF',
        },
      }),
    );

    expect(report.portrait.summary).toContain('讨论参与型');
    expect(report.narrative).toBeUndefined();
    expect(report.evidence).toEqual(expect.any(Array));
    expect(report.metrics).toEqual(expect.objectContaining({
      totalActivities: expect.any(Number),
    }));
  });

  test('maps rule-only narrative into portrait.summary and top-level narrative', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new RuleOnlyNarrativeGateway()),
    ).execute(
      makeInput({
        narrative: {
          mode: 'RULE_ONLY',
        },
      }),
    );

    expect(report.portrait.summary).toBe(report.narrative?.shortSummary);
    expect(report.narrative).toMatchObject({
      generatedBy: 'RULE_ONLY',
      fallbackUsed: false,
      mode: 'RULE_ONLY',
    });
    expect(report.narrative?.headline).toBeTruthy();
  });

  test('maps llm-assisted sections into the optional narrative field while keeping old fields intact', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(
        new StaticNarrativeGateway({
          draft: {
            mode: 'LLM_ASSISTED',
            generatedBy: 'LLM_ASSISTED',
            tone: 'CONCISE',
            audience: 'PRODUCT_USER',
            warnings: [],
            sections: [
              {
                code: 'HEADLINE',
                content: '更偏讨论参与型，当前以回复互动为主。',
                grounded: true,
                supportingEvidenceIds: ['e1'],
              },
              {
                code: 'SHORT_SUMMARY',
                content: '公开活动以回复互动为主，当前样本显示稳定的讨论参与倾向。',
                grounded: true,
                supportingEvidenceIds: ['e1'],
              },
              {
                code: 'CAVEATS',
                content: '当前结果仍只反映已抓取到的公开活动。',
                grounded: true,
              },
            ],
          },
          fallbackUsed: false,
          warnings: [],
        }),
      ),
    ).execute(
      makeInput({
        narrative: {
          mode: 'LLM_ASSISTED',
          tone: 'CONCISE',
          audience: 'PRODUCT_USER',
        },
      }),
    );

    expect(report.portrait.summary).toBe(
      '公开活动以回复互动为主，当前样本显示稳定的讨论参与倾向。',
    );
    expect(report.narrative).toMatchObject({
      generatedBy: 'LLM_ASSISTED',
      headline: '更偏讨论参与型，当前以回复互动为主。',
      caveats: '当前结果仍只反映已抓取到的公开活动。',
    });
    expect(report.evidence).toEqual(expect.any(Array));
    expect(report.metrics).toEqual(expect.any(Object));
    expect(report.communityBreakdowns).toEqual(expect.any(Array));
    expect(report.warnings).toEqual(expect.any(Array));
  });

  test('keeps the main flow alive when llm-assisted generation falls back to rule-only', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(
        new FallbackNarrativeGateway(
          new FailingNarrativeGateway(),
          new RuleOnlyNarrativeGateway(),
          new DisabledNarrativeGateway(),
        ),
      ),
    ).execute(
      makeInput({
        narrative: {
          mode: 'LLM_ASSISTED',
        },
      }),
    );

    expect(report.portrait.summary).toBeTruthy();
    expect(report.narrative).toMatchObject({
      generatedBy: 'RULE_ONLY',
      fallbackUsed: true,
      mode: 'LLM_ASSISTED',
    });
    expect(report.narrative?.warnings).toEqual(
      expect.arrayContaining(['fallback:upstream_error']),
    );
  });

  test('preserves a caveat path for degraded or low-data samples even if narrative is disabled', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new DisabledNarrativeGateway()),
    ).execute(
      makeInput({
        confidenceProfile: makeConfidenceProfile({
          overall: 0.28,
          flags: ['LOW_ACTIVITY_VOLUME', 'DEGRADED_SOURCE'],
        }),
        featureVector: makeFeatureVector({
          dataQuality: {
            degraded: true,
            evidenceDensity: 0.2,
            sufficientData: false,
            qualityFlags: ['LOW_ACTIVITY_VOLUME', 'DEGRADED_SOURCE'],
          },
        }),
        primaryArchetype: {
          code: 'INSUFFICIENT_DATA',
          score: 0.88,
          rationale: 'The sample does not support a stronger primary archetype yet.',
          supportingSignalCodes: ['LOW_DATA'],
        },
        tags: [
          {
            code: 'LOW_DATA',
            displayName: 'low-data',
            summaryHint: 'The current portrait is based on a limited sample.',
            supportingSignalCodes: ['LOW_DATA'],
          },
        ],
        warnings: [
          {
            code: 'PARTIAL_RESULT',
            message: 'Topics were partially available for this request.',
          },
        ],
        narrative: {
          mode: 'OFF',
        },
      }),
    );

    expect(report.portrait.summary).toContain('当前样本有限');
    expect(report.portrait.summary).toContain('谨慎');
    expect(report.narrative).toBeUndefined();
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PARTIAL_RESULT',
        }),
      ]),
    );
  });

  test('keeps narrative integration compatible for both single-account and multi-account reports', async () => {
    const single = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new RuleOnlyNarrativeGateway()),
    ).execute(
      makeInput({
        narrative: {
          mode: 'RULE_ONLY',
        },
      }),
    );
    const multi = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new RuleOnlyNarrativeGateway()),
    ).execute(
      makeInput({
        identityCluster: createIdentityCluster({
          accounts: [
            { community: 'v2ex', handle: 'alpha' },
            { community: 'guozaoke', handle: 'beta' },
          ],
          links: [
            {
              from: { community: 'v2ex', handle: 'alpha' },
              to: { community: 'guozaoke', handle: 'beta' },
              source: 'USER_ASSERTED',
            },
          ],
          mode: 'MANUAL_CLUSTER',
          now: '2026-03-22T00:00:00.000Z',
        }),
        clusterMergeResult: {
          mergedActivities: [],
          perAccountProfiles: [],
          perAccountWarnings: [
            {
              account: { community: 'v2ex', handle: 'alpha' },
              warnings: [],
              degraded: false,
              successful: true,
            },
            {
              account: { community: 'guozaoke', handle: 'beta' },
              warnings: [],
              degraded: false,
              successful: true,
            },
          ],
          clusterWarnings: [],
          degraded: false,
          successfulAccountCount: 2,
          failedAccountCount: 0,
          activeCommunities: ['guozaoke', 'v2ex'],
        },
        fetchResult: {
          identityCluster: createIdentityCluster({
            accounts: [
              { community: 'v2ex', handle: 'alpha' },
              { community: 'guozaoke', handle: 'beta' },
            ],
            mode: 'MANUAL_CLUSTER',
            now: '2026-03-22T00:00:00.000Z',
          }),
          successfulSnapshots: [],
          failedAccounts: [],
          totalAccounts: 2,
          successfulCount: 2,
          failedCount: 0,
          degraded: false,
        },
        synthesisResult: {
          stableTraits: ['DISCUSSION_HEAVY', 'CROSS_COMMUNITY'],
          communityInsights: [
            {
              community: 'v2ex',
              handle: 'alpha',
              dominantTraits: ['DISCUSSION_HEAVY'],
              summaryHint: 'v2ex is more reply-led in the current cluster.',
              confidenceModifier: 0.72,
            },
            {
              community: 'guozaoke',
              handle: 'beta',
              dominantTraits: ['TOPIC_LED'],
              summaryHint: 'guozaoke is more topic-led in the current cluster.',
              confidenceModifier: 0.7,
            },
          ],
        },
        signals: [
          makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.78 }),
          makeSignal({ code: 'CROSS_COMMUNITY', score: 0.74 }),
        ],
        tags: [
          {
            code: 'DISCUSSION_HEAVY',
            displayName: 'discussion-heavy',
            summaryHint: 'Reply activity is a primary participation pattern.',
            supportingSignalCodes: ['DISCUSSION_HEAVY'],
          },
          {
            code: 'CROSS_COMMUNITY',
            displayName: 'cross-community',
            summaryHint: 'The current cluster spans multiple communities.',
            supportingSignalCodes: ['CROSS_COMMUNITY'],
          },
        ],
        narrative: {
          mode: 'RULE_ONLY',
        },
      }),
    );

    expect(single.narrative).toBeDefined();
    expect(single.cluster?.accountCoverage.successfulCount).toBe(1);
    expect(multi.narrative).toBeDefined();
    expect(multi.cluster?.accountCoverage.successfulCount).toBe(2);
    expect(Object.keys(multi.cluster?.communitySpecificTraits ?? {})).toEqual(
      expect.arrayContaining(['guozaoke', 'v2ex']),
    );
  });
});
