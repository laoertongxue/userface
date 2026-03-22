import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import { ReportBuilder } from '@/src/contexts/report-composition/domain/services/ReportBuilder';
import { ApiPresenter, type AnalyzeResponse } from '@/src/contexts/report-composition/infrastructure/presenters/ApiPresenter';
import { NarrativeGatewayResolver } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { resolveNarrativeOptions, resolvePortraitTags, toDisplayArchetype } from '@/src/contexts/report-composition/domain/services/NarrativeReportPolicy';
import type { ClusterInsights } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';

type NarrativeGatewayResolverLike = Pick<NarrativeGatewayResolver, 'resolve'>;

export class ComposePortraitReport {
  constructor(
    private readonly reportBuilder: ReportBuilder = new ReportBuilder(),
    private readonly apiPresenter: ApiPresenter = new ApiPresenter(),
    private readonly narrativeGatewayResolver: NarrativeGatewayResolverLike = new NarrativeGatewayResolver(),
  ) {}

  private buildComposeNarrativeInput(
    input: ComposePortraitReportInput,
    cluster: ClusterInsights,
  ): ComposeNarrativeInput {
    const resolvedNarrative = resolveNarrativeOptions(input.narrative);
    const resolvedTags = resolvePortraitTags(input.tags);

    return {
      portrait: {
        archetype: toDisplayArchetype(input.primaryArchetype.code),
        tags: resolvedTags.map((tag) => tag.displayName),
        summary: this.reportBuilder.buildRuleSummary(input),
        confidence: input.confidenceProfile.overall,
      },
      featureVector: input.featureVector,
      signals: input.signals,
      stableTraits: cluster.stableTraits,
      communitySpecificTraits: cluster.communitySpecificTraits,
      overlap: cluster.overlap,
      divergence: cluster.divergence,
      warnings: input.warnings,
      degraded: input.featureVector.dataQuality.degraded || (input.clusterMergeResult?.degraded ?? false),
      selectedEvidence: input.selectedEvidence,
      accountCoverage: cluster.accountCoverage,
      mode: resolvedNarrative.mode,
      tone: resolvedNarrative.tone,
      audience: resolvedNarrative.audience,
      fallbackPolicy: resolvedNarrative.fallbackPolicy,
    };
  }

  async execute(input: ComposePortraitReportInput): Promise<AnalyzeResponse> {
    const cluster = this.reportBuilder.buildClusterInsights(input);
    const narrativeInput = this.buildComposeNarrativeInput(input, cluster);
    let narrativeResult = undefined;

    try {
      const narrativeGateway = this.narrativeGatewayResolver.resolve(narrativeInput.mode);
      narrativeResult = await narrativeGateway.generateNarrative(narrativeInput);
    } catch {
      narrativeResult = undefined;
    }

    return this.apiPresenter.present(
      this.reportBuilder.build(input, {
        cluster,
        narrativeResult,
      }),
    );
  }
}
