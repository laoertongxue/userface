import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { SuggestIdentityLinks } from '@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks';
import { identitySuggestRequestSchema } from '@/src/contexts/identity-resolution/interfaces/http/identity.schema';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import { RequestGovernanceService } from '@/src/contexts/platform-governance/domain/services/RequestGovernanceService';
import { createSuggestRequestComplexitySnapshot } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';
import { GovernanceHttpMapper } from '@/src/contexts/platform-governance/infrastructure/governance/GovernanceHttpMapper';
import { createRequestFingerprint } from '@/src/contexts/platform-governance/infrastructure/governance/RequestFingerprint';
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
    route: '/api/identity/suggest',
    operation: 'suggest.request',
  });
  const span = observability.startSpan('suggest.request');
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
    observability.logger.event(observabilityEvents.suggestRequestFailed, {
      level: 'warn',
      message: 'Suggest request body was not valid JSON.',
      errorCode: normalizeErrorCode({ error: new ZodError([]) }),
      context: {
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiSuggestRequestTotal, 1, {
      route: '/api/identity/suggest',
      outcome: 'invalid_request',
    });
    observability.metrics.timing(metricNames.apiSuggestRequestDurationMs, completedSpan.durationMs, {
      route: '/api/identity/suggest',
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

  const parsed = identitySuggestRequestSchema.safeParse(body);

  if (!parsed.success) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.suggestRequestFailed, {
      level: 'warn',
      message: 'Suggest request validation failed.',
      errorCode: normalizeErrorCode({ error: parsed.error }),
      context: {
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiSuggestRequestTotal, 1, {
      route: '/api/identity/suggest',
      outcome: 'invalid_request',
    });
    observability.metrics.timing(metricNames.apiSuggestRequestDurationMs, completedSpan.durationMs, {
      route: '/api/identity/suggest',
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

  observability.logger.event(observabilityEvents.suggestRequestReceived, {
    message: 'Identity suggest request received.',
    context: {
      accountCount: parsed.data.accounts.length,
    },
  });

  const governanceDecision = await governanceService.enforce({
    snapshot: createSuggestRequestComplexitySnapshot({
      requestBodyBytes: bodyBytes,
      requestedAt: observability.trace.startedAt,
      requesterFingerprint: createRequestFingerprint(request, '/api/identity/suggest'),
      governanceMode: platformPolicies.requestGovernance.mode,
      accounts: parsed.data.accounts.map((account) => ({
        community: account.community,
      })),
    }),
    requestBudget: platformPolicies.requestGovernance.suggestBudget,
    executionPolicy: platformPolicies.requestGovernance.executionPolicy,
    observability,
  });

  if (!governanceDecision.allowed) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.suggestRequestFailed, {
      level: 'warn',
      message: 'Identity suggest request rejected by governance.',
      errorCode: governanceDecision.errorCode ?? 'INTERNAL_ERROR',
      context: {
        accountCount: parsed.data.accounts.length,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiSuggestRequestTotal, 1, {
      route: '/api/identity/suggest',
      outcome: 'rejected',
    });
    observability.metrics.timing(metricNames.apiSuggestRequestDurationMs, completedSpan.durationMs, {
      route: '/api/identity/suggest',
      outcome: 'rejected',
    });

    const mapped = governanceHttpMapper.toHttpPayload(governanceDecision);

    return respond(mapped.body, { status: mapped.status });
  }

  const releaseDecision = releaseGuardService.evaluate({
    route: '/api/identity/suggest',
    hasCluster: false,
    requestedNarrativeProvider: 'none',
    observability,
  });

  if (!releaseDecision.allowed) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.suggestRequestFailed, {
      level: 'warn',
      message: 'Identity suggest request rejected by release safety guard.',
      errorCode: releaseDecision.reasonCodes[0] ?? 'INTERNAL_ERROR',
      context: {
        accountCount: parsed.data.accounts.length,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiSuggestRequestTotal, 1, {
      route: '/api/identity/suggest',
      outcome: 'rejected',
    });
    observability.metrics.timing(metricNames.apiSuggestRequestDurationMs, completedSpan.durationMs, {
      route: '/api/identity/suggest',
      outcome: 'rejected',
    });

    const mapped = releaseGuardHttpMapper.toHttpPayload(releaseDecision);

    return respond(mapped.body, { status: mapped.status });
  }

  try {
    const result = await new SuggestIdentityLinks(new StaticConnectorRegistry()).execute(parsed.data, {
      traceId: observability.trace.traceId,
      timeoutMs: platformPolicies.requestTimeoutMs,
      locale: parsed.data.locale ?? 'zh-CN',
      observability: observability.child('identity.suggest'),
    });
    const completedSpan = span.finish('success');
    observability.logger.event(observabilityEvents.suggestRequestCompleted, {
      message: 'Identity suggest request completed.',
      context: {
        accountCount: parsed.data.accounts.length,
        suggestionCount: result.suggestions.length,
        warningCount: result.warnings?.length ?? 0,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiSuggestRequestTotal, 1, {
      route: '/api/identity/suggest',
      outcome: 'success',
    });
    observability.metrics.timing(metricNames.apiSuggestRequestDurationMs, completedSpan.durationMs, {
      route: '/api/identity/suggest',
      outcome: 'success',
    });

    return attachTraceHeaders(NextResponse.json(result, { status: 200 }), observability.trace);
  } catch (error) {
    const completedSpan = span.finish('failure');
    observability.logger.event(observabilityEvents.suggestRequestFailed, {
      level: 'error',
      message: 'Identity suggest request failed.',
      errorCode: normalizeErrorCode({ error }),
      context: {
        accountCount: parsed.data.accounts.length,
        durationMs: completedSpan.durationMs,
      },
    });
    observability.metrics.counter(metricNames.apiSuggestRequestTotal, 1, {
      route: '/api/identity/suggest',
      outcome: 'failure',
    });
    observability.metrics.timing(metricNames.apiSuggestRequestDurationMs, completedSpan.durationMs, {
      route: '/api/identity/suggest',
      outcome: 'failure',
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
