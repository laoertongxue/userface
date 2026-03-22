import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type {
  CommunityBreakdown,
  Portrait,
  PortraitEvidence,
  PortraitMetrics,
  PortraitReport,
  PortraitWarning,
} from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import { analysisConfig } from '@/src/config/analysis';
import { normalizeWhitespace, truncateText } from '@/src/shared/utils/text';

function fallbackDisplayCode(code: string): string {
  return code.toLowerCase().replaceAll('_', '-');
}

function toDisplayArchetype(code: ArchetypeCode): string {
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

function dedupeWarnings(warnings: PortraitWarning[]): PortraitWarning[] {
  const seen = new Set<string>();

  return warnings
    .filter((warning) => {
      const key = `${warning.code}:${warning.message}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`),
    );
}

function buildEvidenceLabel(candidate: EvidenceCandidate): string {
  if (candidate.reasons.includes('community-coverage')) {
    return 'Cross-community evidence';
  }

  if (candidate.reasons.includes('node-context')) {
    return 'Node-context evidence';
  }

  if (candidate.activityType === 'topic') {
    return 'Representative topic';
  }

  if (candidate.activityType === 'reply') {
    return 'Representative reply';
  }

  return candidate.labelHint || 'Representative evidence';
}

function mapEvidence(candidates: EvidenceCandidate[]): PortraitEvidence[] {
  const seen = new Set<string>();

  return candidates
    .filter((candidate) => {
      const key = `${candidate.activityId}:${candidate.activityUrl}:${candidate.excerpt}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, analysisConfig.evidenceLimit)
    .map((candidate) => ({
      label: buildEvidenceLabel(candidate),
      excerpt: truncateText(normalizeWhitespace(candidate.excerpt), 180),
      activityUrl: candidate.activityUrl,
      community: candidate.community,
      publishedAt: candidate.publishedAt,
    }));
}

function mapMetrics(input: ComposePortraitReportInput): PortraitMetrics {
  return {
    totalActivities: input.featureVector.activity.totalActivities,
    topicCount: input.featureVector.activity.topicCount,
    replyCount: input.featureVector.activity.replyCount,
    avgTextLength: input.featureVector.content.avgTextLength,
    activeDays: input.featureVector.activity.activeDays,
  };
}

function buildSummary(input: ComposePortraitReportInput): string {
  const { primaryArchetype, tags, featureVector, confidenceProfile } = input;
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
    input.tags.some((tag) => tag.code === 'LOW_DATA') ||
    featureVector.dataQuality.degraded ||
    confidenceProfile.overall < 0.5
      ? ' 当前结论应谨慎解读。'
      : '';

  return `${base}${tagHint}${stableTraitHint}${cautionHint}`.trim();
}

function buildPortrait(input: ComposePortraitReportInput): Portrait {
  const tags: PortraitTag[] =
    input.tags.length > 0
      ? input.tags
      : [
          {
            code: 'LOW_DATA',
            displayName: 'low-data',
            summaryHint: 'The current portrait is based on a limited sample.',
            supportingSignalCodes: ['LOW_DATA'],
          },
        ];

  return {
    archetype: toDisplayArchetype(input.primaryArchetype.code),
    tags: tags.map((tag) => tag.displayName),
    summary: buildSummary({
      ...input,
      tags,
    }),
    confidence: input.confidenceProfile.overall,
  };
}

function buildCommunityBreakdowns(
  input: ComposePortraitReportInput,
  allTags: PortraitTag[],
): CommunityBreakdown[] {
  const insights = input.synthesisResult.communityInsights;

  if (insights.length === 0) {
    return Object.values(input.featureVector.community.perCommunityMetrics)
      .map((metrics) => ({
        community: metrics.community,
        handle: metrics.handle,
        tags: input.tags.slice(0, 2).map((tag) => tag.displayName),
        summary:
          metrics.totalActivities === 0
            ? `Collected no analyzable activities from ${metrics.community}.`
            : `Observed ${metrics.totalActivities} activities on ${metrics.community}.`,
        metrics: {
          totalActivities: metrics.totalActivities,
          topicCount: metrics.topicCount,
          replyCount: metrics.replyCount,
        },
      }))
      .sort((left, right) =>
        `${left.community}:${left.handle}`.localeCompare(`${right.community}:${right.handle}`),
      );
  }

  return insights
    .map((insight) => {
      const key = `${insight.community}:${insight.handle}`;
      const metrics = input.featureVector.community.perCommunityMetrics[key];
      const totalActivities = metrics?.totalActivities ?? 0;
      const topicCount = metrics?.topicCount ?? 0;
      const replyCount = metrics?.replyCount ?? 0;
      const tags =
        insight.dominantTraits.length > 0
          ? insight.dominantTraits.map((code) =>
              allTags.find((tag) => tag.code === code)?.displayName ?? fallbackDisplayCode(code),
            )
          : ['low-data'];

      return {
        community: insight.community,
        handle: insight.handle,
        tags,
        summary: insight.summaryHint,
        metrics: {
          totalActivities,
          topicCount,
          replyCount,
        },
      };
    })
    .sort((left, right) =>
      `${left.community}:${left.handle}`.localeCompare(`${right.community}:${right.handle}`),
    );
}

export class ReportBuilder {
  build(input: ComposePortraitReportInput): PortraitReport {
    const warnings = dedupeWarnings(input.warnings);
    const portrait = buildPortrait(input);
    const evidence = mapEvidence(input.selectedEvidence);
    const metrics = mapMetrics(input);
    const communityBreakdowns = buildCommunityBreakdowns(input, input.tags);

    return {
      portrait,
      evidence,
      metrics,
      communityBreakdowns,
      warnings,
    };
  }
}
