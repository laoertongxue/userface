import type { NormalizedErrorCode } from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import type {
  LogLevel,
  ObservabilitySink,
} from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilitySink';
import type { TraceContext } from '@/src/contexts/platform-governance/infrastructure/observability/TraceContext';
import { defaultObservabilitySink } from '@/src/contexts/platform-governance/infrastructure/observability/ConsoleObservabilitySink';
import { RedactionPolicy } from '@/src/contexts/platform-governance/infrastructure/observability/RedactionPolicy';

export const observabilityEvents = {
  analyzeRequestReceived: 'analyze.request.received',
  analyzeRequestCompleted: 'analyze.request.completed',
  analyzeRequestFailed: 'analyze.request.failed',
  suggestRequestReceived: 'suggest.request.received',
  suggestRequestCompleted: 'suggest.request.completed',
  suggestRequestFailed: 'suggest.request.failed',
  governanceRequestEvaluated: 'governance.request.evaluated',
  governanceRequestRejected: 'governance.request.rejected',
  governanceRequestDegraded: 'governance.request.degraded',
  governanceRateLimitHit: 'governance.rate_limit.hit',
  governanceNarrativeDisabled: 'governance.narrative.disabled',
  releaseGuardEvaluated: 'release.guard.evaluated',
  releaseGuardRejected: 'release.guard.rejected',
  releaseGuardDegraded: 'release.guard.degraded',
  releaseSwitchDisabled: 'release.switch.disabled',
  releaseNarrativeForcedRuleOnly: 'release.narrative.forced_rule_only',
  releaseReadinessEvaluated: 'release.readiness.evaluated',
  incidentModeActive: 'incident.mode.active',
  healthConnectorProbeStarted: 'health.connector.probe.started',
  healthConnectorProbeCompleted: 'health.connector.probe.completed',
  healthConnectorProbeFailed: 'health.connector.probe.failed',
  healthProviderProbeStarted: 'health.provider.probe.started',
  healthProviderProbeCompleted: 'health.provider.probe.completed',
  healthProviderProbeFailed: 'health.provider.probe.failed',
  healthRuntimeCheckCompleted: 'health.runtime.check.completed',
  healthCronProbeCompleted: 'health.cron.probe.completed',
  connectorFetchStarted: 'connector.fetch.started',
  connectorFetchCompleted: 'connector.fetch.completed',
  connectorFetchFailed: 'connector.fetch.failed',
  connectorPartialResult: 'connector.partial_result',
  clusterAnalysisStarted: 'cluster.analysis.started',
  clusterAnalysisCompleted: 'cluster.analysis.completed',
  clusterAnalysisPartialSuccess: 'cluster.analysis.partial_success',
  clusterAnalysisAllFailed: 'cluster.analysis.all_failed',
  clusterActivitiesDeduped: 'cluster.activities.deduped',
  narrativeGenerateStarted: 'narrative.generate.started',
  narrativeGenerateCompleted: 'narrative.generate.completed',
  narrativeGenerateFailed: 'narrative.generate.failed',
  narrativeFallbackUsed: 'narrative.fallback.used',
  reportComposeStarted: 'report.compose.started',
  reportComposeCompleted: 'report.compose.completed',
  reportComposeFailed: 'report.compose.failed',
} as const;

type LogInput = {
  message: string;
  event: string;
  context?: Record<string, unknown>;
  errorCode?: NormalizedErrorCode;
};

export class StructuredLogger {
  constructor(
    private readonly trace: TraceContext,
    private readonly sink: ObservabilitySink = defaultObservabilitySink,
    private readonly redactionPolicy: RedactionPolicy = new RedactionPolicy(),
  ) {}

  private write(level: LogLevel, input: LogInput): void {
    this.sink.emitLog({
      ts: new Date().toISOString(),
      level,
      traceId: this.trace.traceId,
      requestId: this.trace.requestId,
      route: this.trace.route,
      operation: this.trace.operation,
      event: input.event,
      message: input.message,
      context: this.redactionPolicy.sanitizeContext(input.context),
      errorCode: input.errorCode,
    });
  }

  debug(input: LogInput): void {
    this.write('debug', input);
  }

  info(input: LogInput): void {
    this.write('info', input);
  }

  warn(input: LogInput): void {
    this.write('warn', input);
  }

  error(input: LogInput): void {
    this.write('error', input);
  }

  event(event: string, payload: Omit<LogInput, 'event'> & { level?: LogLevel }): void {
    const writer = payload.level === 'debug'
      ? this.debug.bind(this)
      : payload.level === 'warn'
        ? this.warn.bind(this)
        : payload.level === 'error'
          ? this.error.bind(this)
          : this.info.bind(this);

    writer({
      event,
      message: payload.message,
      context: payload.context,
      errorCode: payload.errorCode,
    });
  }
}
