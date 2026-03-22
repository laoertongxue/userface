import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';
import {
  makeConfidenceProfile,
  makeEvidenceCandidate,
  makeFeatureVector,
  makeSignal,
} from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';
import {
  makeComposePortraitReportInput,
  makeStructuredOutput,
} from '@/src/contexts/report-composition/__tests__/regression/narrative/helpers';

export type NarrativeGoldenCase = {
  name: string;
  purpose: string;
  narrativeInput?: ComposeNarrativeInput;
  reportInput?: ComposePortraitReportInput;
  providerOutput?: string;
};

const ruleOnlySingleAccountNarrativeInput = makeComposeNarrativeInput({
  mode: 'RULE_ONLY',
  tone: 'ANALYTICAL',
  audience: 'INTERNAL_QA',
  warnings: [],
  degraded: false,
});

const llmAssistedSingleAccountNarrativeInput = makeComposeNarrativeInput({
  mode: 'LLM_ASSISTED',
  tone: 'CONCISE',
  audience: 'PRODUCT_USER',
  warnings: [],
  degraded: false,
});

const lowDataNarrativeInput = makeComposeNarrativeInput({
  mode: 'LLM_ASSISTED',
  portrait: {
    archetype: 'insufficient-data',
    tags: ['low-data'],
    summary: '当前样本有限，画像结论仅反映已抓取到的公开活动。',
    confidence: 0.28,
  },
  featureVector: makeFeatureVector({
    activity: {
      totalActivities: 2,
      topicCount: 1,
      replyCount: 1,
      activeDays: 1,
      activeSpanDays: 1,
      avgActivitiesPerActiveDay: 2,
    },
    content: {
      avgTextLength: 26,
      longFormRatio: 0,
      substantiveTextRatio: 0.2,
    },
    topic: {
      uniqueNodeCount: 1,
      diversityScore: 0.1,
      topicConcentration: 1,
    },
    dataQuality: {
      degraded: false,
      sufficientData: false,
      evidenceDensity: 0.25,
      qualityFlags: ['LOW_ACTIVITY_VOLUME', 'LOW_ACTIVE_DAYS', 'LOW_TEXT_DENSITY'],
    },
  }),
  stableTraits: [
    {
      code: 'LOW_DATA',
      displayName: 'low-data',
      confidence: 0.91,
      supportingSignals: ['LOW_DATA'],
      sourceCommunities: ['v2ex'],
    },
  ],
  warnings: [
    {
      code: 'LOW_DATA',
      message: 'Only a small amount of public activity was available.',
    },
  ],
  selectedEvidence: [
    makeEvidenceCandidate({
      id: 'ev-low-1',
      activityId: 'low-1',
      excerpt: '短内容样本。',
      textLength: 8,
    }),
  ],
});

const degradedSourceNarrativeInput = makeComposeNarrativeInput({
  mode: 'LLM_ASSISTED',
  degraded: true,
  warnings: [
    {
      code: 'PARTIAL_RESULT',
      message: 'One community only returned a partial result.',
    },
  ],
  accountCoverage: {
    requestedAccounts: [
      { community: 'v2ex', handle: 'alpha' },
      { community: 'guozaoke', handle: 'beta' },
    ],
    successfulAccounts: [{ community: 'v2ex', handle: 'alpha' }],
    failedAccounts: [
      {
        account: { community: 'guozaoke', handle: 'beta' },
        reason: 'Upstream profile fetch failed.',
      },
    ],
    successfulCount: 1,
    failedCount: 1,
    activeCommunities: ['v2ex'],
  },
});

const multiCommunityNarrativeInput = makeComposeNarrativeInput({
  mode: 'LLM_ASSISTED',
  tone: 'CONCISE',
  audience: 'PRODUCT_USER',
  featureVector: makeFeatureVector({
    activity: {
      totalActivities: 26,
      topicCount: 12,
      replyCount: 14,
      activeCommunities: ['guozaoke', 'v2ex'],
      activeCommunityCount: 2,
    },
    community: {
      crossCommunity: true,
      communityActivityShare: {
        guozaoke: 0.46,
        v2ex: 0.54,
      },
      perCommunityMetrics: {
        'v2ex:alpha': {
          community: 'v2ex',
          handle: 'alpha',
          totalActivities: 14,
          topicCount: 5,
          replyCount: 9,
          activeDays: 5,
          avgTextLength: 128,
          longFormRatio: 0.2,
          questionRatio: 0.12,
          linkRatio: 0.03,
        },
        'guozaoke:beta': {
          community: 'guozaoke',
          handle: 'beta',
          totalActivities: 12,
          topicCount: 7,
          replyCount: 5,
          activeDays: 4,
          avgTextLength: 154,
          longFormRatio: 0.32,
          questionRatio: 0.18,
          linkRatio: 0.11,
        },
      },
    },
  }),
  signals: [
    makeSignal({ code: 'DISCUSSION_HEAVY', score: 0.76 }),
    makeSignal({ code: 'CROSS_COMMUNITY', score: 0.8 }),
    makeSignal({ code: 'TOPIC_LED', score: 0.67 }),
  ],
  stableTraits: [
    {
      code: 'DISCUSSION_HEAVY',
      displayName: 'discussion-heavy',
      confidence: 0.76,
      supportingSignals: ['DISCUSSION_HEAVY'],
      sourceCommunities: ['guozaoke', 'v2ex'],
    },
    {
      code: 'CROSS_COMMUNITY',
      displayName: 'cross-community',
      confidence: 0.8,
      supportingSignals: ['CROSS_COMMUNITY'],
      sourceCommunities: ['guozaoke', 'v2ex'],
    },
  ],
  communitySpecificTraits: {
    guozaoke: [
      {
        code: 'TOPIC_LED',
        displayName: 'topic-led',
        rationale: 'guozaoke has the stronger topic-posting pattern in this cluster.',
        strength: 0.72,
      },
    ],
    v2ex: [
      {
        code: 'DISCUSSION_HEAVY',
        displayName: 'discussion-heavy',
        rationale: 'v2ex has the stronger reply-heavy interaction pattern.',
        strength: 0.79,
      },
    ],
  },
  overlap: [
    {
      code: 'DISCUSSION_HEAVY',
      communities: ['guozaoke', 'v2ex'],
      rationale: 'Both communities show sustained discussion activity.',
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
  selectedEvidence: [
    makeEvidenceCandidate({
      id: 'ev-multi-1',
      activityId: 'multi-1',
      community: 'v2ex',
      excerpt: 'A reply-heavy discussion sample from v2ex.',
    }),
    makeEvidenceCandidate({
      id: 'ev-multi-2',
      activityId: 'multi-2',
      community: 'guozaoke',
      activityType: 'topic',
      excerpt: 'A topic-led content sample from guozaoke.',
    }),
  ],
});

export const narrativeGoldenCases: Record<string, NarrativeGoldenCase> = {
  ruleOnlySingleAccount: {
    name: 'rule-only-single-account',
    purpose: 'Stable rule-only narrative for a normal single-account sample.',
    narrativeInput: ruleOnlySingleAccountNarrativeInput,
    reportInput: makeComposePortraitReportInput({
      narrative: {
        mode: 'RULE_ONLY',
        tone: 'ANALYTICAL',
        audience: 'INTERNAL_QA',
      },
    }),
  },
  llmAssistedSingleAccount: {
    name: 'llm-assisted-single-account',
    purpose: 'Successful LLM-assisted narrative for a normal single-account sample.',
    narrativeInput: llmAssistedSingleAccountNarrativeInput,
    providerOutput: makeStructuredOutput([
      {
        code: 'HEADLINE',
        content: '更偏讨论参与型，当前以回复互动为主。',
        sourceHints: ['portrait.archetype', 'portrait.tags'],
        supportingEvidenceIds: ['e1'],
      },
      {
        code: 'SHORT_SUMMARY',
        content: '公开活动呈现稳定的回复互动模式，当前样本更接近讨论参与型画像。',
        sourceHints: ['portrait.summary', 'stableTraits'],
        supportingEvidenceIds: ['e1'],
      },
      {
        code: 'DEEP_SUMMARY',
        content: '核心互动仍由公开回复行为驱动，当前结果与 discussion-heavy 等结构化事实一致。',
        sourceHints: ['signals', 'stableTraits'],
        supportingEvidenceIds: ['e1'],
      },
    ]),
    reportInput: makeComposePortraitReportInput({
      narrative: {
        mode: 'LLM_ASSISTED',
        tone: 'CONCISE',
        audience: 'PRODUCT_USER',
      },
    }),
  },
  lowData: {
    name: 'low-data',
    purpose: 'Narrative must stay conservative when the sample is weak.',
    narrativeInput: lowDataNarrativeInput,
    providerOutput: makeStructuredOutput([
      {
        code: 'HEADLINE',
        content: '当前样本有限，结论需谨慎解读。',
        sourceHints: ['portrait.archetype', 'warnings'],
        supportingEvidenceIds: ['ev-low-1'],
      },
      {
        code: 'SHORT_SUMMARY',
        content: '目前只能看到少量公开活动，因此叙事仅提供有限的方向性描述。',
        sourceHints: ['portrait.summary', 'warnings'],
        supportingEvidenceIds: ['ev-low-1'],
      },
      {
        code: 'CAVEATS',
        content: '当前样本量偏小，结论不应被视为稳定、完整的用户画像。',
        sourceHints: ['warnings', 'degraded'],
      },
    ]),
    reportInput: makeComposePortraitReportInput({
      confidenceProfile: makeConfidenceProfile({
        overall: 0.28,
        flags: ['LOW_ACTIVITY_VOLUME', 'LOW_ACTIVE_DAYS', 'LOW_TEXT_DENSITY'],
      }),
      featureVector: lowDataNarrativeInput.featureVector,
      warnings: lowDataNarrativeInput.warnings,
      tags: [
        {
          code: 'LOW_DATA',
          displayName: 'low-data',
          summaryHint: 'The current portrait is based on a limited sample.',
          supportingSignalCodes: ['LOW_DATA'],
        },
      ],
      signals: [
        makeSignal({ code: 'LOW_DATA', score: 0.91 }),
      ],
      primaryArchetype: {
        code: 'INSUFFICIENT_DATA',
        score: 0.88,
        rationale: 'The sample does not support a stronger primary archetype yet.',
        supportingSignalCodes: ['LOW_DATA'],
      },
      archetype: 'INSUFFICIENT_DATA',
      selectedEvidence: lowDataNarrativeInput.selectedEvidence,
      evidenceCandidates: lowDataNarrativeInput.selectedEvidence,
      narrative: {
        mode: 'LLM_ASSISTED',
        tone: 'CONCISE',
        audience: 'PRODUCT_USER',
      },
    }),
  },
  degradedSource: {
    name: 'degraded-source',
    purpose: 'Narrative must retain caveats when upstream data is partial or degraded.',
    narrativeInput: degradedSourceNarrativeInput,
    providerOutput: makeStructuredOutput([
      {
        code: 'HEADLINE',
        content: '当前结果可读，但需要结合部分成功情形谨慎判断。',
        sourceHints: ['warnings', 'portrait.summary'],
        supportingEvidenceIds: ['e1'],
      },
      {
        code: 'SHORT_SUMMARY',
        content: '现有公开活动仍显示讨论参与倾向，但当前样本包含部分抓取降级。',
        sourceHints: ['portrait.summary', 'warnings'],
        supportingEvidenceIds: ['e1'],
      },
      {
        code: 'CAVEATS',
        content: '由于存在 partial result，当前 narrative 只适合做保守解读。',
        sourceHints: ['warnings', 'degraded'],
      },
    ]),
    reportInput: makeComposePortraitReportInput({
      warnings: degradedSourceNarrativeInput.warnings,
      narrative: {
        mode: 'LLM_ASSISTED',
        tone: 'CONCISE',
        audience: 'PRODUCT_USER',
      },
      identityCluster: createIdentityCluster({
        accounts: [
          { community: 'v2ex', handle: 'alpha' },
          { community: 'guozaoke', handle: 'beta' },
        ],
        mode: 'MANUAL_CLUSTER',
        now: '2026-03-22T00:00:00.000Z',
      }),
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
        failedAccounts: [
          {
            account: { community: 'guozaoke', handle: 'beta' },
            code: 'PARTIAL_RESULT',
            message: 'Upstream partial result.',
          },
        ],
        totalAccounts: 2,
        successfulCount: 1,
        failedCount: 1,
        degraded: true,
      },
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
            warnings: [
              {
                code: 'PARTIAL_RESULT',
                message: 'Upstream partial result.',
              },
            ],
            degraded: true,
            successful: false,
          },
        ],
        clusterWarnings: [
          {
            code: 'PARTIAL_RESULT',
            message: 'One community only returned a partial result.',
          },
        ],
        degraded: true,
        successfulAccountCount: 1,
        failedAccountCount: 1,
        activeCommunities: ['v2ex'],
      },
    }),
  },
  multiCommunity: {
    name: 'multi-community',
    purpose: 'Narrative must distinguish stable traits from community-specific and overlap/divergence output.',
    narrativeInput: multiCommunityNarrativeInput,
    providerOutput: makeStructuredOutput([
      {
        code: 'HEADLINE',
        content: '这是一个跨社区的聚合画像，公共特征和社区差异都比较明确。',
        sourceHints: ['stableTraits', 'communitySpecificTraits', 'overlap'],
        supportingEvidenceIds: ['ev-multi-1'],
      },
      {
        code: 'SHORT_SUMMARY',
        content: '整体上讨论参与倾向贯穿多个社区，但各社区在主题输出和互动强度上仍有差异。',
        sourceHints: ['stableTraits', 'overlap', 'divergence'],
        supportingEvidenceIds: ['ev-multi-1', 'ev-multi-2'],
      },
      {
        code: 'STABLE_TRAITS',
        content: 'discussion-heavy 与 cross-community 是当前聚合画像里最稳定的共同点。',
        sourceHints: ['stableTraits'],
        supportingEvidenceIds: ['ev-multi-1'],
      },
      {
        code: 'COMMUNITY_SPECIFICS',
        content: 'v2ex 更偏回复互动，guozaoke 更偏主题输出。',
        sourceHints: ['communitySpecificTraits'],
        supportingEvidenceIds: ['ev-multi-1', 'ev-multi-2'],
      },
      {
        code: 'OVERLAP_DIVERGENCE',
        content: '两个社区都支持 discussion-heavy，但 guozaoke 上的 topic-led 更突出。',
        sourceHints: ['overlap', 'divergence'],
        supportingEvidenceIds: ['ev-multi-1', 'ev-multi-2'],
      },
    ]),
    reportInput: makeComposePortraitReportInput({
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
      featureVector: multiCommunityNarrativeInput.featureVector,
      signals: multiCommunityNarrativeInput.signals,
      warnings: [],
      selectedEvidence: multiCommunityNarrativeInput.selectedEvidence,
      evidenceCandidates: multiCommunityNarrativeInput.selectedEvidence,
      confidenceProfile: makeConfidenceProfile({
        overall: 0.82,
        reasons: ['cross-community-coverage'],
      }),
      synthesisResult: {
        stableTraits: ['DISCUSSION_HEAVY', 'CROSS_COMMUNITY'],
        communityInsights: [
          {
            community: 'v2ex',
            handle: 'alpha',
            dominantTraits: ['DISCUSSION_HEAVY'],
            summaryHint: 'v2ex is more reply-led in the current cluster.',
            confidenceModifier: 0.79,
          },
          {
            community: 'guozaoke',
            handle: 'beta',
            dominantTraits: ['TOPIC_LED'],
            summaryHint: 'guozaoke is more topic-led in the current cluster.',
            confidenceModifier: 0.72,
          },
        ],
      },
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
        {
          code: 'TOPIC_LED',
          displayName: 'topic-led',
          summaryHint: 'Topic posting is relatively strong.',
          supportingSignalCodes: ['TOPIC_LED'],
        },
      ],
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
      narrative: {
        mode: 'LLM_ASSISTED',
        tone: 'CONCISE',
        audience: 'PRODUCT_USER',
      },
    }),
  },
  parserInvalidOutput: {
    name: 'parser-invalid-output',
    purpose: 'Parser must reject invalid structured output and rely on fallback.',
    narrativeInput: llmAssistedSingleAccountNarrativeInput,
    providerOutput: 'not-json',
  },
  missingCaveatInDegraded: {
    name: 'missing-caveat-in-degraded',
    purpose: 'Degraded inputs must not pass validation without a caveat section.',
    narrativeInput: degradedSourceNarrativeInput,
    providerOutput: makeStructuredOutput([
      {
        code: 'HEADLINE',
        content: '当前结果可读。',
        supportingEvidenceIds: ['e1'],
      },
      {
        code: 'SHORT_SUMMARY',
        content: '存在部分成功，但模型没有提供 caveat。',
        supportingEvidenceIds: ['e1'],
      },
    ]),
  },
  providerTimeout: {
    name: 'provider-timeout',
    purpose: 'Provider timeout must fall back to RuleOnly without breaking the main flow.',
    narrativeInput: llmAssistedSingleAccountNarrativeInput,
  },
  upstreamError: {
    name: 'provider-upstream-error',
    purpose: 'Provider upstream failures must fall back to RuleOnly without breaking the main flow.',
    narrativeInput: llmAssistedSingleAccountNarrativeInput,
  },
};
