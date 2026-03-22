import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AnalyzeResultPanel } from '@/app/analyze/_components/AnalyzeResultPanel';
import type { AnalyzeResponse, DraftAccount } from '@/app/analyze/types';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import { narrativeGoldenCases } from '@/src/contexts/report-composition/__tests__/regression/narrative/goldenCases';
import {
  StaticNarrativeGateway,
  makeNarrativeResult,
  makeResolver,
} from '@/src/contexts/report-composition/__tests__/regression/narrative/helpers';

function renderResult(
  mode: 'SINGLE_ACCOUNT' | 'MANUAL_CLUSTER',
  result: AnalyzeResponse,
  submittedAccounts: DraftAccount[],
) {
  return renderToStaticMarkup(
    createElement(AnalyzeResultPanel, {
      mode,
      result,
      submittedAccounts,
    }),
  );
}

describe('AnalyzeResultPanel narrative compatibility', () => {
  test('renders headline and short summary first while keeping archetype, tags, and confidence visible', async () => {
    const result = await new ComposePortraitReport(
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

    const markup = renderResult('SINGLE_ACCOUNT', result, [
      { community: 'v2ex', handle: 'alpha' },
    ]);

    expect(markup).toContain('更偏讨论参与型，当前以回复互动为主。');
    expect(markup).toContain('公开活动呈现稳定的回复互动模式');
    expect(markup).toContain('Archetype');
    expect(markup).toContain('Portrait Confidence');
    expect(markup).toContain('discussion-heavy');
    expect(markup).toContain('Evidence');
  });

  test('falls back to structured summary when narrative is disabled and still exposes caveats/warnings', async () => {
    const result = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new DisabledNarrativeGateway()),
    ).execute(narrativeGoldenCases.lowData.reportInput!);

    const markup = renderResult('SINGLE_ACCOUNT', result, [
      { community: 'v2ex', handle: 'alpha' },
    ]);

    expect(markup).toContain(result.portrait.summary);
    expect(markup).toContain('Caveats &amp; Warnings');
    expect(markup).toContain('样本有限');
    expect(markup).toContain('Structured Metrics');
  });

  test('renders multi-account cluster sections when present and keeps them distinct from community breakdowns', async () => {
    const result = await new ComposePortraitReport(
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

    const markup = renderResult('MANUAL_CLUSTER', result, [
      { community: 'v2ex', handle: 'alpha' },
      { community: 'guozaoke', handle: 'beta' },
    ]);

    expect(markup).toContain('Traits &amp; Cluster Insights');
    expect(markup).toContain('Stable Traits');
    expect(markup).toContain('Community-Specific Traits');
    expect(markup).toContain('Overlap &amp; Divergence');
    expect(markup).toContain('Account Coverage');
    expect(markup).toContain('Community Breakdowns');
  });

  test('keeps rule-only narrative and structured warnings compatible in degraded fallback-like rendering', async () => {
    const result = await new ComposePortraitReport(
      undefined,
      undefined,
      makeResolver(new RuleOnlyNarrativeGateway()),
    ).execute(narrativeGoldenCases.degradedSource.reportInput!);

    const markup = renderResult('MANUAL_CLUSTER', result, [
      { community: 'v2ex', handle: 'alpha' },
      { community: 'guozaoke', handle: 'beta' },
    ]);

    expect(markup).toContain('Narrative: RULE_ONLY');
    expect(markup).toContain('Caveats &amp; Warnings');
    expect(markup).toContain('PARTIAL_RESULT');
    expect(markup).toContain('Account Coverage');
  });
});
