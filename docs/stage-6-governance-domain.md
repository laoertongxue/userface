# Stage 6 Governance Domain

## Goal

This step freezes the governance-layer language and runtime contracts before any observability, abuse protection, health probes, or release safety logic is implemented.

## Why Contract First

Stage 6 will touch multiple runtime concerns at once:

- trace / log / metric baselines
- request governance and abuse signals
- connector / provider health
- release readiness and incident handling

If those parts invent their own language independently, the system will drift. This step fixes the shared vocabulary first.

## Core Terms

### GovernanceMode

- `OFF`: minimal governance, suitable for local or very small environments
- `BASELINE`: default production-ready governance level
- `STRICT`: stronger runtime constraints and safety posture

### RequestBudget

Represents the allowed request budget for a runtime scope. It covers:

- request count per window
- account count per request
- suggestion pair count per request
- narrative call count per request

It is a governance contract, not a billing model.

### RuntimeExecutionPolicy

Represents per-execution runtime constraints, such as:

- max duration
- connector concurrency
- provider concurrency
- whether narrative, suggestion, and cluster analysis are allowed
- whether provider failure should fall back
- whether connector failure should fail fast when every connector is unavailable

### AbuseSignal

Represents structured runtime risk signals. The first stable signal codes are:

- `TOO_MANY_ACCOUNTS`
- `TOO_MANY_SUGGESTION_PAIRS`
- `TOO_FREQUENT_ANALYZE`
- `TOO_FREQUENT_SUGGEST`
- `OVERSIZED_INPUT`
- `EXCESSIVE_CLUSTER_COMPLEXITY`

These are signals only. They are not enforcement actions yet.

### HealthStatus

Shared health language for connectors, providers, and future runtime probes:

- `HEALTHY`
- `DEGRADED`
- `UNHEALTHY`
- `UNKNOWN`

### ConnectorHealthSnapshot

Minimal health snapshot for a connector:

- community
- health status
- optional latency / success rate
- warnings
- degraded flag

### ProviderHealthSnapshot

Minimal health snapshot for an external provider such as the narrative provider:

- provider
- health status
- optional latency
- optional timeout / invalid response rate
- warnings

### IncidentSeverity

Stable incident severity language:

- `INFO`
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### ReleaseReadiness

Represents whether the current runtime posture is ready for release:

- `ready`
- blockers
- warnings
- checkedAt
- scope

This is governance-oriented readiness, not a CI implementation detail.

### GovernanceSnapshot

Aggregated governance view that can hold:

- governance mode
- execution policy
- request budget
- abuse signals
- connector health
- provider health
- release readiness

It is not a user-facing report and should not replace portrait/report contracts.

## Boundary

The governance layer does not change business facts. It only describes:

- runtime constraints
- runtime status
- failure semantics
- health status
- release readiness

It must not redefine portrait facts, connector parsing results, tags, archetypes, or report semantics.

## Explicit Non-Goals In This Step

This step does not implement:

- tracing, logs, or metrics
- rate limiting or WAF behavior
- cron-based health probes
- release kill switches
- incident runbooks

## How Later Steps Use These Contracts

- Step 2 uses them to tag runtime traces, logs, and metrics consistently
- Step 3 uses them to enforce request budgets and map abuse signals
- Step 4 uses them to express connector/provider health snapshots
- Step 5 uses them to aggregate release readiness and incident severity
