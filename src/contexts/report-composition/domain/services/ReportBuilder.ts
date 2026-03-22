import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type {
  ClusterInsights,
  CommunityBreakdown,
  Portrait,
  PortraitEvidence,
  PortraitNarrative,
  PortraitMetrics,
  PortraitReport,
  PortraitWarning,
} from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import { analysisConfig } from '@/src/config/analysis';
import { ClusterReportBuilder } from '@/src/contexts/report-composition/domain/services/ClusterReportBuilder';
import { NarrativeReportMapper } from '@/src/contexts/report-composition/domain/services/NarrativeReportMapper';
import {
  buildRuleSummary,
  resolvePortraitTags,
  toDisplayArchetype,
} from '@/src/contexts/report-composition/domain/services/NarrativeReportPolicy';
import { normalizeWhitespace, truncateText } from '@/src/shared/utils/text';

function fallbackDisplayCode(code: string): string {
  return code.toLowerCase().replaceAll('_', '-');
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

function buildPortrait(
  input: ComposePortraitReportInput,
  tags: PortraitTag[],
  summary: string,
): Portrait {
  return {
    archetype: toDisplayArchetype(input.primaryArchetype.code),
    tags: tags.map((tag) => tag.displayName),
    summary,
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
  constructor(
    private readonly clusterReportBuilder: ClusterReportBuilder = new ClusterReportBuilder(),
    private readonly narrativeReportMapper: NarrativeReportMapper = new NarrativeReportMapper(),
  ) {}

  buildClusterInsights(input: ComposePortraitReportInput): ClusterInsights {
    return this.clusterReportBuilder.build(input);
  }

  buildRuleSummary(input: ComposePortraitReportInput): string {
    return buildRuleSummary(input, resolvePortraitTags(input.tags));
  }

  build(
    input: ComposePortraitReportInput,
    options: {
      cluster?: ClusterInsights;
      narrativeResult?: NarrativeGenerationResult;
    } = {},
  ): PortraitReport {
    const warnings = dedupeWarnings(input.warnings);
    const resolvedTags = resolvePortraitTags(input.tags);
    const cluster = options.cluster ?? this.clusterReportBuilder.build(input);
    const narrativeMapping = this.narrativeReportMapper.map({
      input,
      defaultSummary: buildRuleSummary(input, resolvedTags),
      narrativeOptions: input.narrative,
      narrativeResult: options.narrativeResult,
    });
    const portrait = buildPortrait(input, resolvedTags, narrativeMapping.summary);
    const evidence = mapEvidence(input.selectedEvidence);
    const metrics = mapMetrics(input);
    const communityBreakdowns = buildCommunityBreakdowns(input, resolvedTags);
    const narrative: PortraitNarrative | undefined = narrativeMapping.narrative;

    return {
      portrait,
      evidence,
      metrics,
      communityBreakdowns,
      warnings,
      cluster,
      narrative,
    };
  }
}
