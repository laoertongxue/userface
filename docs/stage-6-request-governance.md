# Stage 6 Request Governance

## Goal

Before adding health probes or release switches, the runtime needs a stable application-layer request governance baseline. This step adds one governance path for `/api/analyze` and `/api/identity/suggest` so oversized, overly frequent, or overly complex requests are handled before business execution starts.

## Why Do This Before WAF

Platform WAF or edge rules can block obvious abuse, but they do not understand this product's workload shape:

- cluster account count
- suggestion pair explosion
- narrative runtime cost
- route-specific request budgets

Application-layer governance provides those domain-aware limits first. Later edge protection can wrap it, not replace it.

## RequestComplexitySnapshot

Each governed request is reduced to a small complexity snapshot:

- `route`
- `requestBodyBytes`
- `requestedAt`
- `requesterFingerprint`
- `governanceMode`
- `accountCount`
- `uniqueCommunities`
- `clusterMode`
- `narrativeMode`
- `estimatedNarrativeCalls`
- `estimatedSuggestionPairs`
- `estimatedClusterPairs`
- `hasCluster`
- `hasNarrative`

It intentionally does not include raw post text, raw evidence, prompt content, or full user payloads.

## How Budget And Policy Are Used

`RequestBudget` defines route-level limits.

`RuntimeExecutionPolicy` defines what the runtime may still do if a request is allowed, including whether narrative is permitted.

`RequestGovernanceService` evaluates both against the current `RequestComplexitySnapshot`, applies rate limiting, emits abuse signals, and returns one `GovernanceDecision`.

## Default Rules

Current baseline is intentionally small and fixed in code:

### `/api/analyze`

- max request body: `8192` bytes
- max accounts: `6`
- max communities: `3`
- max cluster complexity score: `18`
- max narrative complexity score: `12`
- max narrative calls per request: `1`
- rate limit: `20` requests per `60` seconds per fingerprint

### `/api/identity/suggest`

- max request body: `6144` bytes
- max accounts: `8`
- max communities: `3`
- max suggestion pairs: `15`
- max cluster complexity score: `24`
- rate limit: `30` requests per `60` seconds per fingerprint

### Complexity Score

The first version is a linear score:

- account count
- extra community count
- cluster pair count
- suggestion pair count
- narrative enabled flag

This is meant to stay simple and explainable.

## Decision Semantics

`RequestGovernanceService.enforce(...)` returns:

- `allowed`
- `degraded`
- `disableNarrative`
- `abuseSignals`
- `errorCode`
- `httpStatus`
- `retryAfterSeconds`

### Allow

Request may continue into the business use case unchanged.

### Reject

Used for:

- oversized body
- too many accounts
- too many suggestion pairs
- route-level rate limit
- excessive cluster complexity

### Degrade

Used when the request is still acceptable for the core analyze path, but optional cost should be removed.

Current first-class degrade case:

- `NARRATIVE_BUDGET_EXCEEDED` -> allow request, set `disableNarrative = true`

## RateLimitAdapter

`RateLimitAdapter` is the abstraction.

`InMemoryRateLimitAdapter` is the default implementation for the current stage:

- process-local
- deterministic enough for local and basic production use
- no distributed guarantees

This keeps governance logic stable even if a future stage adds Redis, edge rate limiting, or platform firewall integration.

## Observability

Governance decisions now emit:

- `governance.request.evaluated`
- `governance.request.rejected`
- `governance.request.degraded`
- `governance.rate_limit.hit`
- `governance.narrative.disabled`

And metrics:

- `governance.request_total`
- `governance.request_rejected_total`
- `governance.request_degraded_total`
- `governance.rate_limit_hit_total`
- `governance.narrative_disabled_total`

Only route, mode, outcome, error code, counts, and durations are recorded. Raw content is not logged.

## Out Of Scope

This step does not implement:

- WAF dashboard rules
- cron health probes
- release kill switch
- remote dynamic config

## Next Steps

- Stage 6 Step 4 can use governance signals and existing observability to define health baselines.
- Stage 6 Step 5 can reuse governance error codes and degradation semantics for release safety and kill-switch design.
