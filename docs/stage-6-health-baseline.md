# Stage 6 Health Baseline

## Goal

This step adds a lightweight health baseline for connectors, narrative providers, and local runtime state. The system can now answer whether it is currently `HEALTHY`, `DEGRADED`, `UNHEALTHY`, or `UNKNOWN` without running a full analyze workflow.

## Health Endpoints

### `/api/health/connectors`

Checks lightweight synthetic probes for enabled public connectors.

Response shape:

- `status`
- `checkedAt`
- `targets: ConnectorHealthSnapshot[]`
- `warnings`

### `/api/health/narrative`

Checks narrative provider capability.

Targets currently include:

- `disabled`
- `rule-only`
- `minimax`

MiniMax is probed with a minimal structured narrative request, not a real user payload.

### `/api/health/runtime`

Checks local runtime readiness:

- governance bootstrap
- observability bootstrap
- narrative provider config consistency
- cron auth token presence

It returns:

- `status`
- `checkedAt`
- `targets`
- `warnings`
- `blockers`

## Probe Design

### Connector Probe

Connector probes use each connector's lightweight `probe(...)` path or equivalent public profile lookup. They do not fetch full topics/replies pages across multiple pages and do not run cluster analysis.

Default probe targets are centralized in `ProbePolicy` so target accounts are not scattered across the codebase.

### Narrative Provider Probe

Narrative probing uses a very small synthetic `ComposeNarrativeInput`.

- `disabled` and `rule-only` are checked locally.
- `minimax` is checked with a minimal structured call.
- fallback is intentionally not treated as provider health success.

### Runtime Self-Check

Runtime self-check only validates local runtime readiness and config consistency. It does not expose secret values.

## Aggregation Rules

### Connectors

- all healthy -> `HEALTHY`
- any degraded and none unhealthy -> `DEGRADED`
- any unhealthy -> `UNHEALTHY`
- all unknown -> `UNKNOWN`

### Narrative Providers

- all healthy -> `HEALTHY`
- minimax unhealthy but rule-only/disabled healthy -> `DEGRADED`
- all unknown -> `UNKNOWN`
- no fallback path and provider unhealthy -> `UNHEALTHY`

### Runtime

- blockers present -> `UNHEALTHY`
- warnings without blockers -> `DEGRADED`
- no blockers or warnings -> `HEALTHY`

## Cron Probe

`/api/cron/health-probe` runs one aggregated sweep:

- connector probes
- narrative provider probes
- runtime self-check

It is protected by `Authorization: Bearer <token>`.

Accepted env sources:

- `HEALTH_PROBE_CRON_TOKEN`
- fallback: `CRON_SECRET`

If the token is missing, the cron route remains protected and runtime self-check reports this as a degraded capability.

Recommended cadence for the first version: every 15 minutes.

## Observability

Health baseline emits:

- `health.connector.probe.started`
- `health.connector.probe.completed`
- `health.connector.probe.failed`
- `health.provider.probe.started`
- `health.provider.probe.completed`
- `health.provider.probe.failed`
- `health.runtime.check.completed`
- `health.cron.probe.completed`

Metrics:

- `health.connector_probe_total`
- `health.connector_probe_duration_ms`
- `health.provider_probe_total`
- `health.provider_probe_duration_ms`
- `health.runtime_check_total`
- `health.runtime_check_duration_ms`
- `health.cron_probe_total`

Only target ids, status, duration, warnings count, and outcome are recorded. Raw HTML, raw provider responses, and secrets are not logged.

## Out Of Scope

This step does not implement:

- history persistence
- alerting
- automatic switch toggling
- third-party monitoring vendor integration

## Next Steps

- Stage 6 Step 5 can use these health statuses to drive release safety and kill-switch policy.
- Stage 6 Step 6 can validate manual probe behavior, cron auth, and degraded/unhealthy semantics against these endpoints.
