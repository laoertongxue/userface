import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import { ReportBuilder } from '@/src/contexts/report-composition/domain/services/ReportBuilder';
import { ApiPresenter, type AnalyzeResponse } from '@/src/contexts/report-composition/infrastructure/presenters/ApiPresenter';
import { NarrativeGatewayResolver } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { resolveNarrativeOptions, resolvePortraitTags, toDisplayArchetype } from '@/src/contexts/report-composition/domain/services/NarrativeReportPolicy';
import type { ClusterInsights } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

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
      observability: input.observability?.child('narrative.generate'),
    };
  }

  async execute(input: ComposePortraitReportInput): Promise<AnalyzeResponse> {
    const observability = input.observability?.child('report.compose');
    const span = observability?.startSpan('report.compose');
    observability?.logger.event(observabilityEvents.reportComposeStarted, {
      message: 'Portrait report composition started.',
      context: {
        accountCount: input.identityCluster.accounts.length,
        warningCount: input.warnings.length,
        narrativeMode: input.narrative?.mode ?? 'OFF',
      },
    });
    const cluster = this.reportBuilder.buildClusterInsights(input);
    const narrativeInput = this.buildComposeNarrativeInput(input, cluster);
    let narrativeResult = undefined;

    try {
      const narrativeGateway = this.narrativeGatewayResolver.resolve(narrativeInput.mode);
      narrativeResult = await narrativeGateway.generateNarrative(narrativeInput);
    } catch {
      narrativeResult = undefined;
    }

    try {
      const report = this.apiPresenter.present(
        this.reportBuilder.build(input, {
          cluster,
          narrativeResult,
        }),
      );
      const completedSpan = span?.finish('success');
      const hasNarrative = Boolean(report.narrative);

      observability?.logger.event(observabilityEvents.reportComposeCompleted, {
        message: 'Portrait report composition completed.',
        context: {
          hasNarrative,
          generatedBy: report.narrative?.generatedBy ?? 'NONE',
          hasFallback: report.narrative?.fallbackUsed ?? false,
          warningsPresent: report.warnings.length > 0,
          summarySource: report.narrative?.shortSummary ? 'narrative' : 'rule',
          durationMs: completedSpan?.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.reportComposeTotal, 1, {
        outcome: 'success',
        hasFallback: report.narrative?.fallbackUsed ?? false,
      });
      if (completedSpan) {
        observability?.metrics.timing(metricNames.reportComposeDurationMs, completedSpan.durationMs, {
          outcome: 'success',
          hasFallback: report.narrative?.fallbackUsed ?? false,
        });
      }

      return report;
    } catch (error) {
      const failedSpan = span?.finish('failure');
      observability?.logger.event(observabilityEvents.reportComposeFailed, {
        level: 'error',
        message: 'Portrait report composition failed.',
        errorCode: normalizeErrorCode({ error }),
        context: {
          durationMs: failedSpan?.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.reportComposeTotal, 1, {
        outcome: 'failure',
      });
      if (failedSpan) {
        observability?.metrics.timing(metricNames.reportComposeDurationMs, failedSpan.durationMs, {
          outcome: 'failure',
        });
      }
      throw error;
    }
  }
}
