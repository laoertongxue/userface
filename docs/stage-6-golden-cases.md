# Stage 6 Golden Cases

## Purpose

This document freezes the Stage 6 regression baseline for production governance.

These cases are deterministic and network-free. They are intended to protect:

- observability structure
- request governance semantics
- health and probe semantics
- release safety and incident-mode behavior

## Scope

The golden cases cover:

- baseline healthy operation
- analyze rate limiting
- suggest pair explosion
- narrative budget degradation
- connector degradation
- provider fallback safety
- incident-mode cluster and suggest shutdown
- release readiness not-ready states

They do not cover:

- real external traffic
- third-party observability vendors
- distributed rate limiting
- platform-level rollout systems

## Cases

### `baseline-healthy`

- Purpose: keep a normal single-account analyze request inside the healthy governance envelope.
- Input:
  - one analyze account
  - request budget within limits
  - connectors healthy
  - provider healthy or safely disabled
  - incident inactive
- Expected boundary:
  - governance allows the request
  - no abuse signal
  - overall health is `HEALTHY`
  - release readiness is `ready=true`

### `analyze-rate-limited`

- Purpose: keep route-level analyze throttling stable.
- Input:
  - repeated `/api/analyze` requests from one requester fingerprint inside one budget window
- Expected boundary:
  - governance rejects the repeated request
  - `errorCode = GOVERNANCE_RATE_LIMITED`
  - `retryAfterSeconds` exists
  - observability records a rate-limit hit

### `suggest-pair-explosion`

- Purpose: stop `suggest` pair growth before business execution starts.
- Input:
  - many accounts in `/api/identity/suggest`
  - estimated suggestion pairs exceed the budget
- Expected boundary:
  - governance rejects the request
  - abuse signals include `TOO_MANY_SUGGESTION_PAIRS`
  - suggestion use case does not run

### `narrative-budget-disabled`

- Purpose: preserve the main analyze path when narrative is the only expensive part.
- Input:
  - analyze request still valid
  - narrative enabled
  - narrative complexity exceeds the narrative budget only
- Expected boundary:
  - governance allows the request
  - governance marks it degraded
  - `disableNarrative = true`
  - main analyze path can still continue

### `connector-degraded`

- Purpose: ensure partial connector degradation is visible without being mistaken for a full runtime outage.
- Input:
  - one connector `DEGRADED`
  - remaining connectors healthy
- Expected boundary:
  - connector health aggregate is `DEGRADED`
  - overall health is `DEGRADED`
  - release readiness records warnings, not mandatory blockers

### `provider-fallback-safe`

- Purpose: keep MiniMax failure compatible with safe RuleOnly fallback.
- Input:
  - MiniMax probe fails or degrades
  - RuleOnly provider remains healthy
- Expected boundary:
  - provider health aggregate is `DEGRADED`
  - release readiness may warn but does not have to block
  - narrative enhancement can still fall back safely

### `incident-mode-cluster-off`

- Purpose: lock incident-mode contraction behavior.
- Input:
  - `INCIDENT` mode active
  - cluster and suggest paths treated as unsafe
- Expected boundary:
  - cluster analyze is rejected
  - single-account analyze remains allowed
  - suggest is rejected
  - the reason codes are explicit and stable

### `release-not-ready`

- Purpose: keep release-readiness blockers explainable.
- Input:
  - incident active, or analyze disabled, or runtime unhealthy, or connectors all unhealthy
- Expected boundary:
  - `/api/health/release-readiness` returns `ready=false`
  - blockers are not empty
  - the response explains why the system should not be considered ready

## Automated Coverage

Stage 6 regression now covers:

- observability baseline regression
- request governance regression
- health and probe regression
- release safety and incident regression
- existing route compatibility tests for analyze, suggest, health, and cron routes

The regression suite focuses on structure and semantics, not UI or external platform integration.
