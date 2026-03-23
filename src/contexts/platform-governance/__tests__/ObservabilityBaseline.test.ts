import { describe, expect, test } from 'vitest';
import { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';
import { MetricsRecorder } from '@/src/contexts/platform-governance/infrastructure/observability/MetricsRecorder';
import { StructuredLogger, observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import { createTraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { normalizeErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import { RedactionPolicy } from '@/src/contexts/platform-governance/infrastructure/observability/RedactionPolicy';
import {
  createTestObservabilityContext,
  MemoryObservabilitySink,
} from '@/src/contexts/platform-governance/__tests__/observabilityTestHelpers';
import { AcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import { NarrativeGatewayError } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayError';
import { MiniMaxNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/MiniMaxNarrativeGateway';
import {
  FallbackNarrativeGateway,
} from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayResolver';
import { RuleOnlyNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/RuleOnlyNarrativeGateway';
import { DisabledNarrativeGateway } from '@/src/contexts/report-composition/infrastructure/narrative/DisabledNarrativeGateway';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';
import { readNarrativeGatewayConfig } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayConfig';

describe('observability baseline', () => {
  test('TraceContext can be created from request headers and propagated via child contexts', () => {
    const request = new Request('http://localhost/api/analyze', {
      headers: {
        'x-trace-id': 'trace-from-header',
        'x-request-id': 'request-from-header',
      },
    });
    const root = ObservabilityContext.fromRequest({
      request,
      route: '/api/analyze',
      operation: 'analyze.request',
      sink: new MemoryObservabilitySink(),
    });
    const child = root.child('connector.fetch');

    expect(root.trace.traceId).toBe('trace-from-header');
    expect(root.trace.requestId).toBe('request-from-header');
    expect(child.trace.traceId).toBe('trace-from-header');
    expect(child.trace.operation).toBe('connector.fetch');
  });

  test('StructuredLogger emits stable structured log entries', () => {
    const sink = new MemoryObservabilitySink();
    const trace = createTraceContext({
      route: '/api/analyze',
      operation: 'analyze.request',
      traceId: 'trace-logger',
      requestId: 'request-logger',
      startedAt: '2026-03-23T10:00:00.000Z',
    });
    const logger = new StructuredLogger(trace, sink);

    logger.event(observabilityEvents.analyzeRequestReceived, {
      message: 'Analyze request received.',
      context: {
        accountCount: 2,
        handle: 'alpha',
      },
    });

    expect(sink.logs).toHaveLength(1);
    expect(sink.logs[0]).toMatchObject({
      level: 'info',
      traceId: 'trace-logger',
      requestId: 'request-logger',
      route: '/api/analyze',
      operation: 'analyze.request',
      event: 'analyze.request.received',
      message: 'Analyze request received.',
      context: {
        accountCount: 2,
        handle: expect.stringMatching(/^hash:/),
      },
    });
    expect(typeof sink.logs[0].ts).toBe('string');
  });

  test('MetricsRecorder records counter and timing entries with stable tags', () => {
    const sink = new MemoryObservabilitySink();
    const metrics = new MetricsRecorder(
      createTraceContext({
        route: '/api/analyze',
        operation: 'analyze.request',
        traceId: 'trace-metrics',
        requestId: 'request-metrics',
      }),
      sink,
    );

    metrics.counter(metricNames.apiAnalyzeRequestTotal, 1, {
      route: '/api/analyze',
      outcome: 'success',
    });
    metrics.timing(metricNames.apiAnalyzeRequestDurationMs, 123, {
      route: '/api/analyze',
      outcome: 'success',
    });

    expect(sink.metrics).toEqual([
      expect.objectContaining({
        kind: 'counter',
        name: metricNames.apiAnalyzeRequestTotal,
        value: 1,
        tags: {
          outcome: 'success',
          route: '/api/analyze',
        },
      }),
      expect.objectContaining({
        kind: 'timing',
        name: metricNames.apiAnalyzeRequestDurationMs,
        value: 123,
        tags: {
          outcome: 'success',
          route: '/api/analyze',
        },
      }),
    ]);
  });

  test('RedactionPolicy removes long text, prompt-like fields, and masks identifiers', () => {
    const policy = new RedactionPolicy();
    const context = policy.sanitizeContext({
      handle: 'alpha',
      prompt: 'system prompt should not be logged',
      excerpt: 'evidence excerpt should never be logged',
      notes: 'x'.repeat(160),
      count: 3,
    });

    expect(context).toEqual({
      handle: expect.stringMatching(/^hash:/),
      prompt: '[REDACTED]',
      excerpt: '[REDACTED]',
      notes: '[REDACTED_TEXT:length=160]',
      count: 3,
    });
  });

  test('normalizeErrorCode maps connector and narrative failures to stable observability codes', () => {
    expect(normalizeErrorCode({
      error: AcquisitionError.fromStatus(429, 'https://example.com'),
    })).toBe('RATE_LIMITED');
    expect(normalizeErrorCode({
      error: AcquisitionError.timeout('https://example.com'),
    })).toBe('CONNECTOR_FAILURE');
    expect(normalizeErrorCode({
      error: NarrativeGatewayError.timeout('minimax'),
    })).toBe('NARRATIVE_TIMEOUT');
    expect(normalizeErrorCode({
      error: NarrativeGatewayError.invalidResponse('bad payload', 'minimax'),
    })).toBe('NARRATIVE_INVALID_RESPONSE');
    expect(normalizeErrorCode({
      warningCode: 'SELECTOR_CHANGED',
    })).toBe('CONNECTOR_SELECTOR_CHANGED');
  });

  test('narrative fallback records failed generation and fallback usage without fatally breaking the flow', async () => {
    const sink = new MemoryObservabilitySink();
    const config = readNarrativeGatewayConfig({
      NARRATIVE_PROVIDER: 'minimax',
      NARRATIVE_TIMEOUT_MS: 1500,
      MINIMAX_API_KEY: 'key',
      MINIMAX_BASE_URL: 'https://api.minimax.example/v1',
      MINIMAX_MODEL: 'abab-1.0-chat',
    });
    const gateway = new FallbackNarrativeGateway(
      new MiniMaxNarrativeGateway(config, async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      }),
      new RuleOnlyNarrativeGateway(),
      new DisabledNarrativeGateway(),
    );

    const result = await gateway.generateNarrative(
      makeComposeNarrativeInput({
        mode: 'LLM_ASSISTED',
        observability: createTestObservabilityContext(sink, {
          route: '/api/analyze',
          operation: 'narrative.generate',
        }),
      }),
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.draft?.generatedBy).toBe('RULE_ONLY');
    expect(sink.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'narrative.generate.failed',
          errorCode: 'NARRATIVE_TIMEOUT',
        }),
        expect.objectContaining({
          event: 'narrative.fallback.used',
          errorCode: 'NARRATIVE_FALLBACK_USED',
        }),
      ]),
    );
    expect(sink.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: metricNames.narrativeFallbackTotal,
        }),
      ]),
    );
  });
});
