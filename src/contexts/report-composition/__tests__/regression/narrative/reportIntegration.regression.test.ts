import { describe, expect, test } from 'vitest';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import {
  FallbackNarrativeGateway,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import { narrativeGoldenCases } from '@/src/contexts/report-composition/__tests__/regression/narrative/goldenCases';
import {
  FailingNarrativeGateway,
  StaticNarrativeGateway,
  makeNarrativeResult,
  makeResolver,
} from '@/src/contexts/report-composition/__tests__/regression/narrative/helpers';

describe('Stage 5 narrative report integration regression', () => {
  test('keeps portrait.summary grounded in rule-only single-account mode', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new RuleOnlyNarrativeGateway()),
    ).execute(narrativeGoldenCases.ruleOnlySingleAccount.reportInput!);

    expect(report.portrait.summary).toBe(report.narrative?.shortSummary);
    expect(report.narrative).toMatchObject({
      generatedBy: 'RULE_ONLY',
      fallbackUsed: false,
      mode: 'RULE_ONLY',
    });
    expect(report.portrait.archetype).toBeTruthy();
    expect(report.evidence.length).toBeGreaterThan(0);
  });

  test('uses llm-assisted short summary and preserves structured fields', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(
        new StaticNarrativeGateway(
          makeNarrativeResult([
            {
              code: 'HEADLINE',
              content: '更偏讨论参与型，当前以回复互动为主。',
              grounded: true,
              supportingEvidenceIds: ['e1'],
            },
            {
              code: 'SHORT_SUMMARY',
              content: '公开活动呈现稳定的回复互动模式，当前样本更接近讨论参与型画像。',
              grounded: true,
              supportingEvidenceIds: ['e1'],
            },
            {
              code: 'CAVEATS',
              content: '当前结果仍只反映已抓取到的公开活动。',
              grounded: true,
            },
          ]),
        ),
      ),
    ).execute(narrativeGoldenCases.llmAssistedSingleAccount.reportInput!);

    expect(report.portrait.summary).toBe('公开活动呈现稳定的回复互动模式，当前样本更接近讨论参与型画像。');
    expect(report.narrative?.generatedBy).toBe('LLM_ASSISTED');
    expect(report.narrative?.headline).toContain('讨论参与型');
    expect(report.metrics).toEqual(expect.objectContaining({
      totalActivities: expect.any(Number),
    }));
    expect(report.communityBreakdowns).toEqual(expect.any(Array));
  });

  test('preserves a caveat path for low-data and degraded samples', async () => {
    const lowDataReport = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(
        new StaticNarrativeGateway(
          makeNarrativeResult([
            {
              code: 'HEADLINE',
              content: '当前样本有限，结论需谨慎解读。',
              grounded: true,
              supportingEvidenceIds: ['ev-low-1'],
            },
            {
              code: 'SHORT_SUMMARY',
              content: '目前只能看到少量公开活动，因此叙事仅提供有限的方向性描述。',
              grounded: true,
              supportingEvidenceIds: ['ev-low-1'],
            },
            {
              code: 'CAVEATS',
              content: '当前样本量偏小，结论不应被视为稳定、完整的用户画像。',
              grounded: true,
            },
          ]),
        ),
      ),
    ).execute(narrativeGoldenCases.lowData.reportInput!);
    const degradedReport = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(
        new FallbackNarrativeGateway(
          new FailingNarrativeGateway(),
          new RuleOnlyNarrativeGateway(),
          new DisabledNarrativeGateway(),
        ),
      ),
    ).execute(narrativeGoldenCases.degradedSource.reportInput!);

    expect(lowDataReport.narrative?.caveats).toBeTruthy();
    expect(lowDataReport.portrait.summary).toContain('有限');
    expect(degradedReport.narrative?.caveats).toBeTruthy();
    expect(degradedReport.narrative?.fallbackUsed).toBe(true);
    expect(degradedReport.narrative?.warnings).toEqual(
      expect.arrayContaining(['fallback:upstream_error']),
    );
  });

  test('keeps multi-community narrative separate from stable/community/overlap structured fields', async () => {
    const report = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(
        new StaticNarrativeGateway(
          makeNarrativeResult([
            {
              code: 'HEADLINE',
              content: '这是一个跨社区的聚合画像，公共特征和社区差异都比较明确。',
              grounded: true,
              supportingEvidenceIds: ['ev-multi-1'],
            },
            {
              code: 'SHORT_SUMMARY',
              content: '整体上讨论参与倾向贯穿多个社区，但各社区在主题输出和互动强度上仍有差异。',
              grounded: true,
              supportingEvidenceIds: ['ev-multi-1', 'ev-multi-2'],
            },
            {
              code: 'STABLE_TRAITS',
              content: 'discussion-heavy 与 cross-community 是当前聚合画像里最稳定的共同点。',
              grounded: true,
              supportingEvidenceIds: ['ev-multi-1'],
            },
            {
              code: 'COMMUNITY_SPECIFICS',
              content: 'v2ex 更偏回复互动，guozaoke 更偏主题输出。',
              grounded: true,
              supportingEvidenceIds: ['ev-multi-1', 'ev-multi-2'],
            },
            {
              code: 'OVERLAP_DIVERGENCE',
              content: '两个社区都支持 discussion-heavy，但 guozaoke 上的 topic-led 更突出。',
              grounded: true,
              supportingEvidenceIds: ['ev-multi-1', 'ev-multi-2'],
            },
          ]),
        ),
      ),
    ).execute(narrativeGoldenCases.multiCommunity.reportInput!);

    expect(report.cluster?.stableTraits.length).toBeGreaterThan(0);
    expect(Object.keys(report.cluster?.communitySpecificTraits ?? {})).toEqual([
      'guozaoke',
      'v2ex',
    ]);
    expect(report.cluster?.overlap?.length).toBeGreaterThan(0);
    expect(report.cluster?.divergence?.length).toBeGreaterThan(0);
    expect(report.narrative?.stableTraitsSummary).toContain('cross-community');
    expect(report.narrative?.communitySpecificSummary).toContain('v2ex');
    expect(report.narrative?.overlapDivergenceSummary).toContain('guozaoke');
  });
});
