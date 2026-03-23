# Stage 6 Observability Baseline

## Goal

This step adds the first production-observability baseline for the current runtime:

- request-level trace context
- structured logs
- minimal metrics
- normalized error codes
- redaction rules

It does not change any business contract or runtime policy yet.

## TraceContext

Each request now gets a lightweight trace contract with:

- `traceId`
- `requestId`
- `route`
- `operation`
- `startedAt`
- `parentTraceId?`

`/api/analyze` and `/api/identity/suggest` create the root trace context. Internal orchestration reuses the same `traceId` and only narrows `operation`.

When available, `x-trace-id` and `x-request-id` headers are reused. Otherwise new ids are generated. Responses write back `x-trace-id` without changing the JSON body.

## StructuredLogger

Structured logging is centralized behind `StructuredLogger`. Every log entry includes:

- `ts`
- `level`
- `traceId`
- `requestId`
- `route`
- `operation`
- `event`
- `message`
- `context`
- `errorCode?`

The baseline intentionally records runtime metadata only. It does not log raw post content, evidence content, prompt bodies, or provider response bodies.

## MetricsRecorder

`MetricsRecorder` provides:

- `counter(name, value?, tags?)`
- `timing(name, durationMs, tags?)`
- `gauge(name, value, tags?)`

The default sink is console-backed and vendor-neutral. It is enough for local and baseline runtime inspection, while leaving room for later vendor integration.

## Stable Event Names

### API

- `analyze.request.received`
- `analyze.request.completed`
- `analyze.request.failed`
- `suggest.request.received`
- `suggest.request.completed`
- `suggest.request.failed`

### Connector / Acquisition

- `connector.fetch.started`
- `connector.fetch.completed`
- `connector.fetch.failed`
- `connector.partial_result`

### Cluster

- `cluster.analysis.started`
- `cluster.analysis.completed`
- `cluster.analysis.partial_success`
- `cluster.analysis.all_failed`
- `cluster.activities.deduped`

### Narrative

- `narrative.generate.started`
- `narrative.generate.completed`
- `narrative.generate.failed`
- `narrative.fallback.used`

### Report

- `report.compose.started`
- `report.compose.completed`
- `report.compose.failed`

## Stable Metric Names

### API

- `api.analyze.request_total`
- `api.analyze.request_duration_ms`
- `api.suggest.request_total`
- `api.suggest.request_duration_ms`

### Connector

- `connector.fetch_total`
- `connector.fetch_duration_ms`
- `connector.partial_result_total`

### Cluster

- `cluster.analysis_total`
- `cluster.partial_success_total`
- `cluster.all_failed_total`
- `cluster.accounts_requested`
- `cluster.accounts_successful`
- `cluster.accounts_failed`
- `cluster.activities_deduped_total`

### Narrative

- `narrative.generate_total`
- `narrative.generate_duration_ms`
- `narrative.fallback_total`
- `narrative.invalid_response_total`

### Report

- `report.compose_total`
- `report.compose_duration_ms`

## Error Normalization

Observability uses a small normalized catalog instead of raw error types:

- `INVALID_REQUEST`
- `NOT_FOUND`
- `PARTIAL_RESULT`
- `RATE_LIMITED`
- `CONNECTOR_FAILURE`
- `CONNECTOR_SELECTOR_CHANGED`
- `CLUSTER_ALL_FAILED`
- `CLUSTER_PARTIAL_SUCCESS`
- `NARRATIVE_TIMEOUT`
- `NARRATIVE_INVALID_RESPONSE`
- `NARRATIVE_FALLBACK_USED`
- `INTERNAL_ERROR`

These codes are for logs and metrics only. They do not redefine API response codes.

## Redaction Rules

The baseline redaction policy follows a strict default:

- do not log raw prompt bodies
- do not log raw provider responses
- do not log raw post content
- do not log raw evidence excerpts
- do not log tokens, cookies, or API keys
- do not log raw handles when a hash is enough

Prefer logging:

- counts
- enums
- codes
- booleans
- durations
- per-community outcomes
- hashed identifiers when minimal correlation is needed

## Current Instrumentation Points

The baseline now instruments:

- `/api/analyze`
- `/api/identity/suggest`
- cluster snapshot fetching
- cluster analysis and activity dedupe
- narrative generation and fallback
- portrait report composition

## Explicit Non-Goals In This Step

This step does not implement:

- external observability vendor integration
- WAF / rate limiting
- health probes / cron checks
- release kill switch or runbook execution

## How Later Steps Build On This

- Step 3 uses these traces, logs, metrics, and normalized error codes for request governance and abuse signals
- Step 4 uses them to aggregate connector/provider health and availability
- Step 5 uses them to support release readiness, incident severity, and runtime kill-switch decisions
