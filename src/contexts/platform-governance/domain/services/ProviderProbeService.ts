import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { MiniMaxNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/MiniMaxNarrativeGateway';
import {
  readNarrativeGatewayConfig,
  type NarrativeGatewayConfig,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';
import {
  NarrativeGatewayError,
  ensureNarrativeGatewayError,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import type { ProviderProbeInput } from '@/src/contexts/platform-governance/application/dto/ProviderProbeInput';
import {
  createHealthProbeResult,
  type HealthProbeResult,
} from '@/src/contexts/platform-governance/application/dto/HealthProbeResult';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

type FetchLike = typeof fetch;

function makeProbeNarrativeInput(mode: ComposeNarrativeInput['mode']): ComposeNarrativeInput {
  return {
    portrait: {
      archetype: 'discussion-oriented',
      tags: ['discussion-heavy'],
      summary: 'Synthetic health probe narrative input.',
      confidence: 0.7,
    },
    featureVector: {
      activity: {
        totalActivities: 4,
        topicCount: 1,
        replyCount: 3,
        topicRatio: 0.25,
        replyRatio: 0.75,
        activeDays: 2,
        activeSpanDays: 2,
        avgActivitiesPerActiveDay: 2,
        activeCommunities: ['v2ex'],
        activeCommunityCount: 1,
      },
      content: {
        avgTextLength: 48,
        nonEmptyContentRatio: 1,
        longFormRatio: 0.2,
        questionRatio: 0.1,
        linkRatio: 0,
        substantiveTextRatio: 0.8,
      },
      topic: {
        dominantTopics: [],
        dominantNodes: [],
        uniqueNodeCount: 1,
        topicConcentration: 0.6,
        diversityScore: 0.4,
        nodeCoverageRatio: 1,
      },
      community: {
        communityActivityShare: { v2ex: 1 },
        perCommunityMetrics: {
          v2ex: {
            community: 'v2ex',
            handle: 'probe-user',
            totalActivities: 4,
            topicCount: 1,
            replyCount: 3,
            activeDays: 2,
            avgTextLength: 48,
            longFormRatio: 0.2,
            questionRatio: 0.1,
            linkRatio: 0,
          },
        },
        crossCommunity: false,
      },
      dataQuality: {
        degraded: false,
        evidenceDensity: 0.7,
        sufficientData: true,
        qualityFlags: [],
      },
    },
    signals: [
      {
        code: 'DISCUSSION_HEAVY',
        score: 0.7,
        rationale: 'Synthetic probe signal.',
        supportingEvidenceIds: ['probe-evidence'],
        communityScope: 'global',
      },
    ],
    stableTraits: [
      {
        code: 'DISCUSSION_HEAVY',
        displayName: 'discussion-heavy',
        confidence: 0.7,
        supportingSignals: ['DISCUSSION_HEAVY'],
        sourceCommunities: ['v2ex'],
      },
    ],
    communitySpecificTraits: {},
    overlap: [],
    divergence: [],
    warnings: [],
    degraded: false,
    selectedEvidence: [
      {
        id: 'probe-evidence',
        activityId: 'probe-activity',
        community: 'v2ex',
        labelHint: 'probe',
        excerpt: 'Synthetic probe evidence.',
        activityUrl: 'https://example.com/probe',
        publishedAt: '2026-03-23T00:00:00.000Z',
        reasons: ['probe'],
      },
    ],
    accountCoverage: {
      requestedAccounts: [{ community: 'v2ex', handle: 'probe-user' }],
      successfulAccounts: [{ community: 'v2ex', handle: 'probe-user' }],
      failedAccounts: [],
      successfulCount: 1,
      failedCount: 0,
      activeCommunities: ['v2ex'],
    },
    mode,
    tone: 'CONCISE',
    audience: 'INTERNAL_QA',
    fallbackPolicy: {
      mode: 'USE_RULE_SUMMARY',
      allowRuleSummary: true,
      allowEmptyDraft: false,
      includeFallbackWarnings: false,
    },
  };
}

function mapProviderErrorStatus(error: NarrativeGatewayError): HealthProbeResult['status'] {
  if (error.code === 'CONFIG_ERROR' || error.code === 'DISABLED' || error.code === 'UNSUPPORTED_PROVIDER') {
    return 'UNKNOWN';
  }

  if (error.code === 'UPSTREAM_ERROR') {
    return 'UNHEALTHY';
  }

  return 'DEGRADED';
}

export class ProviderProbeService {
  constructor(
    private readonly config: NarrativeGatewayConfig = readNarrativeGatewayConfig(),
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async probe(input: ProviderProbeInput): Promise<HealthProbeResult> {
    const observability = input.observability?.child(`health.provider.${input.provider}`);
    const span = observability?.startSpan(`health.provider.${input.provider}`);
    observability?.logger.event(observabilityEvents.healthProviderProbeStarted, {
      message: 'Provider health probe started.',
      context: {
        targetType: 'provider',
        targetId: input.provider,
        provider: input.provider,
      },
    });

    try {
      if (input.provider === 'disabled') {
        const result = await new DisabledNarrativeGateway().generateNarrative(
          makeProbeNarrativeInput('OFF'),
        );
        const completedSpan = span?.finish('success');
        const probeResult = createHealthProbeResult({
          targetType: 'provider',
          targetId: 'disabled',
          status: 'HEALTHY',
          checkedAt: new Date().toISOString(),
          durationMs: completedSpan?.durationMs ?? 0,
          success: true,
          degraded: false,
          warnings: result.warnings ?? [],
        });

        observability?.logger.event(observabilityEvents.healthProviderProbeCompleted, {
          message: 'Provider health probe completed.',
          context: {
            targetType: 'provider',
            targetId: input.provider,
            provider: input.provider,
            status: probeResult.status,
            outcome: 'success',
            durationMs: probeResult.durationMs,
          },
        });
        observability?.metrics.counter(metricNames.healthProviderProbeTotal, 1, {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: 'success',
        });
        observability?.metrics.timing(metricNames.healthProviderProbeDurationMs, probeResult.durationMs, {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: 'success',
        });

        return probeResult;
      }

      if (input.provider === 'rule-only') {
        const result = await new RuleOnlyNarrativeGateway().generateNarrative(
          makeProbeNarrativeInput('RULE_ONLY'),
        );
        const completedSpan = span?.finish('success');
        const probeResult = createHealthProbeResult({
          targetType: 'provider',
          targetId: 'rule-only',
          status: result.draft ? 'HEALTHY' : 'DEGRADED',
          checkedAt: new Date().toISOString(),
          durationMs: completedSpan?.durationMs ?? 0,
          success: Boolean(result.draft),
          degraded: !result.draft,
          warnings: result.warnings ?? [],
        });

        observability?.logger.event(observabilityEvents.healthProviderProbeCompleted, {
          message: 'Provider health probe completed.',
          context: {
            targetType: 'provider',
            targetId: input.provider,
            provider: input.provider,
            status: probeResult.status,
            outcome: probeResult.success ? 'success' : 'degraded',
            durationMs: probeResult.durationMs,
          },
        });
        observability?.metrics.counter(metricNames.healthProviderProbeTotal, 1, {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: probeResult.success ? 'success' : 'degraded',
        });
        observability?.metrics.timing(metricNames.healthProviderProbeDurationMs, probeResult.durationMs, {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: probeResult.success ? 'success' : 'degraded',
        });

        return probeResult;
      }

      if (!this.config.minimax.isConfigured) {
        const completedSpan = span?.finish('partial');
        const probeResult = createHealthProbeResult({
          targetType: 'provider',
          targetId: 'minimax',
          status: 'UNKNOWN',
          checkedAt: new Date().toISOString(),
          durationMs: completedSpan?.durationMs ?? 0,
          success: false,
          degraded: false,
          errorCode: 'CONFIG_ERROR',
          message: 'MiniMax provider is not fully configured for health probing.',
          warnings: ['provider-not-configured'],
        });

        observability?.logger.event(observabilityEvents.healthProviderProbeCompleted, {
          level: 'warn',
          message: 'Provider health probe completed with unknown provider state.',
          context: {
            targetType: 'provider',
            targetId: input.provider,
            provider: input.provider,
            status: probeResult.status,
            outcome: 'unknown',
            durationMs: probeResult.durationMs,
          },
        });
        observability?.metrics.counter(metricNames.healthProviderProbeTotal, 1, {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: 'unknown',
        });
        observability?.metrics.timing(metricNames.healthProviderProbeDurationMs, probeResult.durationMs, {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: 'unknown',
        });

        return probeResult;
      }

      const gateway = new MiniMaxNarrativeGateway(
        {
          ...this.config,
          timeoutMs: input.timeoutMs,
        },
        this.fetchImpl,
      );
      const result = await gateway.generateNarrative(makeProbeNarrativeInput('LLM_ASSISTED'));
      const completedSpan = span?.finish('success');
      const probeResult = createHealthProbeResult({
        targetType: 'provider',
        targetId: 'minimax',
        status: result.draft?.generatedBy === 'LLM_ASSISTED' ? 'HEALTHY' : 'DEGRADED',
        checkedAt: new Date().toISOString(),
        durationMs: completedSpan?.durationMs ?? 0,
        success: result.draft?.generatedBy === 'LLM_ASSISTED',
        degraded: result.draft?.generatedBy !== 'LLM_ASSISTED',
        warnings: result.warnings ?? [],
      });

      observability?.logger.event(observabilityEvents.healthProviderProbeCompleted, {
        message: 'Provider health probe completed.',
        context: {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          status: probeResult.status,
          outcome: probeResult.success ? 'success' : 'degraded',
          durationMs: probeResult.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.healthProviderProbeTotal, 1, {
        targetType: 'provider',
        targetId: input.provider,
        provider: input.provider,
        status: probeResult.status,
        outcome: probeResult.success ? 'success' : 'degraded',
      });
      observability?.metrics.timing(metricNames.healthProviderProbeDurationMs, probeResult.durationMs, {
        targetType: 'provider',
        targetId: input.provider,
        provider: input.provider,
        status: probeResult.status,
        outcome: probeResult.success ? 'success' : 'degraded',
      });

      return probeResult;
    } catch (error) {
      const gatewayError = ensureNarrativeGatewayError(error, input.provider);
      const failedSpan = span?.finish('failure');
      const probeResult = createHealthProbeResult({
        targetType: 'provider',
        targetId: input.provider,
        status: mapProviderErrorStatus(gatewayError),
        checkedAt: new Date().toISOString(),
        durationMs: failedSpan?.durationMs ?? 0,
        success: false,
        degraded: mapProviderErrorStatus(gatewayError) === 'DEGRADED',
        errorCode: normalizeErrorCode({ error: gatewayError }),
        message: gatewayError.message,
        warnings: [gatewayError.code.toLowerCase()],
      });

      observability?.logger.event(observabilityEvents.healthProviderProbeFailed, {
        level: 'error',
        message: 'Provider health probe failed.',
        errorCode: normalizeErrorCode({ error: gatewayError }),
        context: {
          targetType: 'provider',
          targetId: input.provider,
          provider: input.provider,
          durationMs: probeResult.durationMs,
          gatewayCode: gatewayError.code,
        },
      });
      observability?.metrics.counter(metricNames.healthProviderProbeTotal, 1, {
        targetType: 'provider',
        targetId: input.provider,
        provider: input.provider,
        status: probeResult.status,
        outcome: 'failure',
      });
      observability?.metrics.timing(metricNames.healthProviderProbeDurationMs, probeResult.durationMs, {
        targetType: 'provider',
        targetId: input.provider,
        provider: input.provider,
        status: probeResult.status,
        outcome: 'failure',
      });

      return probeResult;
    }
  }

  async probeAll(
    inputs: ProviderProbeInput[],
  ): Promise<HealthProbeResult[]> {
    return Promise.all(inputs.map((input) => this.probe(input)));
  }

  async probeDefaultTargets(input: {
    observability?: ProviderProbeInput['observability'];
  } = {}): Promise<HealthProbeResult[]> {
    return this.probeAll(
      platformPolicies.health.providerTargets.map((provider) => ({
        provider,
        timeoutMs: platformPolicies.health.providerTimeoutMs,
        governanceMode: platformPolicies.requestGovernance.mode,
        observability: input.observability,
      })),
    );
  }
}
