import type { NarrativeFallbackPolicy } from '@/src/contexts/report-composition/application/dto/NarrativeFallbackPolicy';
import type {
  ComposePortraitReportInput,
  ComposePortraitReportNarrativeOptions,
} from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import type { NarrativeAudience } from '@/src/contexts/report-composition/domain/value-objects/NarrativeAudience';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import type { NarrativeTone } from '@/src/contexts/report-composition/domain/value-objects/NarrativeTone';

export const DEFAULT_NARRATIVE_FALLBACK_POLICY: NarrativeFallbackPolicy = {
  mode: 'USE_RULE_SUMMARY',
  allowRuleSummary: true,
  allowEmptyDraft: false,
  includeFallbackWarnings: true,
};

export const DEFAULT_NARRATIVE_TONE: NarrativeTone = 'ANALYTICAL';
export const DEFAULT_NARRATIVE_AUDIENCE: NarrativeAudience = 'PRODUCT_USER';
export const DEFAULT_NARRATIVE_MODE: NarrativeMode = 'OFF';

function fallbackDisplayCode(code: string): string {
  return code.toLowerCase().replaceAll('_', '-');
}

export function toDisplayArchetype(code: ArchetypeCode): string {
  switch (code) {
    case 'COMMUNITY_PARTICIPANT':
      return 'community-participant';
    case 'DISCUSSION_ORIENTED':
      return 'discussion-oriented';
    case 'INFORMATION_CURATOR':
      return 'information-curator';
    case 'INSUFFICIENT_DATA':
      return 'insufficient-data';
    case 'OBSERVER':
      return 'observer';
    case 'PROBLEM_SOLVER':
      return 'problem-solver';
    case 'TOPIC_ORIENTED':
      return 'topic-oriented';
  }
}

export function resolveNarrativeOptions(
  overrides?: Partial<ComposePortraitReportNarrativeOptions>,
): ComposePortraitReportNarrativeOptions {
  return {
    mode: overrides?.mode ?? DEFAULT_NARRATIVE_MODE,
    tone: overrides?.tone ?? DEFAULT_NARRATIVE_TONE,
    audience: overrides?.audience ?? DEFAULT_NARRATIVE_AUDIENCE,
    fallbackPolicy: overrides?.fallbackPolicy ?? DEFAULT_NARRATIVE_FALLBACK_POLICY,
  };
}

export function resolvePortraitTags(tags: PortraitTag[]): PortraitTag[] {
  return tags.length > 0
    ? tags
    : [
        {
          code: 'LOW_DATA',
          displayName: 'low-data',
          summaryHint: 'The current portrait is based on a limited sample.',
          supportingSignalCodes: ['LOW_DATA'],
        },
      ];
}

export function buildRuleSummary(
  input: ComposePortraitReportInput,
  tags: PortraitTag[],
): string {
  const { primaryArchetype, featureVector, confidenceProfile } = input;
  const leadingTags = tags
    .filter((tag) => tag.code !== 'LOW_DATA')
    .slice(0, 2)
    .map((tag) => tag.displayName);

  let base: string;

  switch (primaryArchetype.code) {
    case 'INSUFFICIENT_DATA':
      base = '当前样本有限，画像结论仅反映已抓取到的公开活动。';
      break;
    case 'DISCUSSION_ORIENTED':
      base = '更偏讨论参与型，活跃方式以回复互动为主。';
      break;
    case 'TOPIC_ORIENTED':
      base = '更偏主题输出型，公开活动中主题创建占比较高。';
      break;
    case 'COMMUNITY_PARTICIPANT':
      base = '表现为较稳定的社区参与型，在公开活动中持续互动。';
      break;
    case 'OBSERVER':
      base = '当前更接近轻量参与型，公开活动存在但输出强度有限。';
      break;
    case 'PROBLEM_SOLVER':
      base = '更偏问题解决型，公开活动以回应与解释为主。';
      break;
    case 'INFORMATION_CURATOR':
      base = '更偏信息整理型，公开活动中更常见主题输出与内容组织。';
      break;
  }

  const tagHint =
    leadingTags.length > 0
      ? ` 当前更显著的特征包括 ${leadingTags.join('、')}。`
      : '';
  const stableTraitHint =
    input.synthesisResult.stableTraits.length > 0 && featureVector.activity.activeCommunityCount > 1
      ? ` 跨社区稳定特征包括 ${input.synthesisResult.stableTraits
          .slice(0, 2)
          .map((code) => fallbackDisplayCode(code))
          .join('、')}。`
      : '';
  const cautionHint =
    tags.some((tag) => tag.code === 'LOW_DATA') ||
    featureVector.dataQuality.degraded ||
    confidenceProfile.overall < 0.5
      ? ' 当前结论应谨慎解读。'
      : '';

  return `${base}${tagHint}${stableTraitHint}${cautionHint}`.trim();
}

export function buildFallbackCaveat(
  input: ComposePortraitReportInput,
  tags: PortraitTag[],
): string | undefined {
  const reasons: string[] = [];

  if (input.featureVector.dataQuality.degraded || input.clusterMergeResult?.degraded) {
    reasons.push('当前结果包含降级抓取或部分成功账号。');
  }

  if (tags.some((tag) => tag.code === 'LOW_DATA')) {
    reasons.push('当前样本量有限，结论只代表已抓取到的公开活动。');
  }

  if (input.confidenceProfile.overall < 0.5) {
    reasons.push('当前置信度偏低，建议结合结构化指标与 evidence 一并解读。');
  }

  if (input.warnings.length > 0) {
    reasons.push('请同时参考 warnings 中的采集限制与部分结果提示。');
  }

  if (reasons.length === 0) {
    return undefined;
  }

  return reasons.join(' ');
}
