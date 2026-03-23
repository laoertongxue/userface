import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { runAnalyzePipeline } from '@/src/app-services/analyze/runAnalyzePipeline';
import { analyzeRequestSchema } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';
import { RequestGovernanceService } from '@/src/contexts/platform-governance/domain/services/RequestGovernanceService';
import { createAnalyzeRequestComplexitySnapshot } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import { GovernanceHttpMapper } from '@/src/contexts/platform-governance/infrastructure/governance/GovernanceHttpMapper';
import { createRequestFingerprint } from '@/src/contexts/platform-governance/infrastructure/governance/RequestFingerprint';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { attachTraceHeaders } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import { ReleaseGuardService } from '@/src/contexts/platform-governance/domain/services/ReleaseGuardService';
import { ReleaseGuardHttpMapper } from '@/src/contexts/platform-governance/infrastructure/release/ReleaseGuardHttpMapper';

export const runtime = 'nodejs';
export const maxDuration = 60;

const governanceService = new RequestGovernanceService();
const governanceHttpMapper = new GovernanceHttpMapper();
const releaseGuardService = new ReleaseGuardService();
const releaseGuardHttpMapper = new ReleaseGuardHttpMapper();

export async function POST(request: Request) {
  const observability = ObservabilityContext.fromRequest({
    request,
    route: '/api/analyze',
    operation: 'analyze.request',
  });
  const span = observability.startSpan('analyze.request');
  let body: unknown;
  const rawBody = await request.text();
  const bodyBytes = new TextEncoder().encode(rawBody).length;

  const respond = (payload: unknown, init: ResponseInit) => {
    const response = attachTraceHeaders(NextResponse.json(payload, init), observability.trace);

    if (payload && typeof payload === 'object' && 'error' in payload) {
      const retryAfterSeconds = (
        payload as { error?: { retryAfterSeconds?: number } }
      ).error?.retryAfterSeconds;

      if (retryAfterSeconds) {
        response.headers.set('retry-after', String(retryAfterSeconds));
      }
    }

    return response;
  };

  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.analyzeRequestFailed, {
      level: 'warn',
      message: 'Analyze request body was not valid JSON.',
      errorCode: normalizeErrorCode({ error: new ZodError([]) }),
      context: {
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: 'invalid_request',
    });
    observability.metrics.timing(metricNames.apiAnalyzeRequestDurationMs, completedSpan.durationMs, {
      route: '/api/analyze',
      outcome: 'invalid_request',
    });

    return respond(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: {
            formErrors: ['Request body must be valid JSON.'],
            fieldErrors: {},
          },
        },
      },
      { status: 400 },
    );
  }

  const parsed = analyzeRequestSchema.safeParse(body);

  if (!parsed.success) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.analyzeRequestFailed, {
      level: 'warn',
      message: 'Analyze request validation failed.',
      errorCode: normalizeErrorCode({ error: parsed.error }),
      context: {
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: 'invalid_request',
    });
    observability.metrics.timing(metricNames.apiAnalyzeRequestDurationMs, completedSpan.durationMs, {
      route: '/api/analyze',
      outcome: 'invalid_request',
    });

    return respond(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const accountCount = parsed.data.identity.accounts.length;
  const mode = accountCount > 1 ? 'cluster' : 'single';
  observability.logger.event(observabilityEvents.analyzeRequestReceived, {
    message: 'Analyze request received.',
    context: {
      accountCount,
      mode,
      llmProvider: parsed.data.options?.llmProvider ?? 'none',
    },
  });
  const governanceDecision = await governanceService.enforce({
    snapshot: createAnalyzeRequestComplexitySnapshot({
      requestBodyBytes: bodyBytes,
      requestedAt: observability.trace.startedAt,
      requesterFingerprint: createRequestFingerprint(request, '/api/analyze'),
      governanceMode: platformPolicies.requestGovernance.mode,
      accounts: parsed.data.identity.accounts.map((account) => ({
        community: account.community,
      })),
      llmProvider: parsed.data.options?.llmProvider,
    }),
    requestBudget: platformPolicies.requestGovernance.analyzeBudget,
    executionPolicy: platformPolicies.requestGovernance.executionPolicy,
    observability,
  });

  if (!governanceDecision.allowed) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.analyzeRequestFailed, {
      level: 'warn',
      message: 'Analyze request rejected by governance.',
      errorCode: governanceDecision.errorCode ?? 'INTERNAL_ERROR',
      context: {
        accountCount,
        mode,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: 'rejected',
      mode,
    });
    observability.metrics.timing(metricNames.apiAnalyzeRequestDurationMs, completedSpan.durationMs, {
      route: '/api/analyze',
      outcome: 'rejected',
      mode,
    });

    const mapped = governanceHttpMapper.toHttpPayload(governanceDecision);

    return respond(mapped.body, { status: mapped.status });
  }

  const releaseDecision = releaseGuardService.evaluate({
    route: '/api/analyze',
    hasCluster: mode === 'cluster',
    requestedNarrativeProvider: parsed.data.options?.llmProvider ?? 'none',
    observability,
  });

  if (!releaseDecision.allowed) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.analyzeRequestFailed, {
      level: 'warn',
      message: 'Analyze request rejected by release safety guard.',
      errorCode: releaseDecision.reasonCodes[0] ?? 'INTERNAL_ERROR',
      context: {
        accountCount,
        mode,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: 'rejected',
      mode,
    });
    observability.metrics.timing(metricNames.apiAnalyzeRequestDurationMs, completedSpan.durationMs, {
      route: '/api/analyze',
      outcome: 'rejected',
      mode,
    });

    const mapped = releaseGuardHttpMapper.toHttpPayload(releaseDecision);

    return respond(mapped.body, { status: mapped.status });
  }

  const disableNarrative =
    governanceDecision.disableNarrative || releaseDecision.degradationPlan.disableNarrative;
  const forceRuleOnlyNarrative =
    !disableNarrative && releaseDecision.degradationPlan.forceRuleOnlyNarrative;
  const governedRequest = governanceDecision.disableNarrative
    ? {
        ...parsed.data,
        options: {
          ...parsed.data.options,
          llmProvider: 'none' as const,
        },
      }
    : parsed.data;
  const releaseSafeRequest = disableNarrative
    ? {
        ...parsed.data,
        options: {
          ...parsed.data.options,
          llmProvider: 'none' as const,
        },
      }
    : governedRequest;

  try {
    const result = await runAnalyzePipeline(releaseSafeRequest, {
      traceId: observability.trace.traceId,
      observability,
      narrativeModeOverride: forceRuleOnlyNarrative ? 'RULE_ONLY' : undefined,
    });
    const completedSpan = span.finish(
      result.cluster?.accountCoverage.failedCount ? 'partial' : 'success',
    );
    observability.logger.event(observabilityEvents.analyzeRequestCompleted, {
      message: 'Analyze request completed.',
      context: {
        accountCount,
        mode,
        durationMs: completedSpan.durationMs,
        degraded: result.warnings.length > 0 || (result.cluster?.accountCoverage.failedCount ?? 0) > 0,
        warningsCount: result.warnings.length,
        hasNarrative: Boolean(result.narrative),
        hasFallback: result.narrative?.fallbackUsed ?? false,
        governanceDegraded: governanceDecision.degraded,
        releaseMode: releaseDecision.mode,
        releaseDegraded: disableNarrative || forceRuleOnlyNarrative,
      },
    });
    observability.metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: (result.cluster?.accountCoverage.failedCount ?? 0) > 0 ? 'partial' : 'success',
      mode,
    });
    observability.metrics.timing(metricNames.apiAnalyzeRequestDurationMs, completedSpan.durationMs, {
      route: '/api/analyze',
      outcome: (result.cluster?.accountCoverage.failedCount ?? 0) > 0 ? 'partial' : 'success',
      mode,
    });

    return attachTraceHeaders(NextResponse.json(result, { status: 200 }), observability.trace);
  } catch (error) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.analyzeRequestFailed, {
      level: 'error',
      message: 'Analyze request failed.',
      errorCode: normalizeErrorCode({ error }),
      context: {
        accountCount,
        mode,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: 'failure',
      mode,
    });
    observability.metrics.timing(metricNames.apiAnalyzeRequestDurationMs, completedSpan.durationMs, {
      route: '/api/analyze',
      outcome: 'failure',
      mode,
    });

    if (error instanceof ZodError) {
      return respond(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
            details: error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    return respond(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected server error',
        },
      },
      { status: 500 },
    );
  }
}
