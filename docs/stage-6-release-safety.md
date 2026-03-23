# Stage 6 Release Safety

## Goal

Stage 6 Step 5 adds a small, internal release-safety layer before any external flag platform or deployment control plane exists. The purpose is to let the service:

- disable risky routes quickly
- degrade expensive enhancements safely
- expose a minimal release-readiness view
- keep `/api/analyze` and `/api/identity/suggest` contracts unchanged

## Why Start In-App First

Before external flags, rollback automation, or vendor platforms, the service still needs a deterministic runtime policy. This step freezes:

- which capabilities can be turned off
- which capabilities can be degraded
- how incident mode affects analyze, cluster, suggest, and narrative
- how runtime health and switch state roll up into release readiness

This keeps later integrations thin. External flag providers can replace the provider layer, not the decision semantics.

## Core Language

### `FeatureSwitchKey`

Runtime safety switches, not product experiment flags.

- `ANALYZE_ENABLED`
- `CLUSTER_ANALYSIS_ENABLED`
- `SUGGEST_ENABLED`
- `NARRATIVE_ENABLED`
- `MINIMAX_ENABLED`
- `HEALTH_PROBES_ENABLED`
- `STRICT_GOVERNANCE_ENABLED`

### `ReleaseSafetyMode`

- `NORMAL`: normal service mode
- `DEGRADED`: core path stays up, expensive enhancement is reduced
- `INCIDENT`: incident mode; prefer rejecting risky paths and shrinking capability surface

### `IncidentState`

Current runtime incident view. It is env-driven in this phase and contains:

- whether incident mode is active
- severity
- current mode
- incident reason
- startedAt
- active switch keys

### `DegradationPlan`

Execution plan produced by release guard:

- `disableNarrative`
- `forceRuleOnlyNarrative`
- `disableSuggest`
- `disableClusterAnalysis`
- `disableAnalyze`
- `reasonCodes`

## EnvSwitchProvider

Current switches are environment-driven through `EnvSwitchProvider`.

Supported env keys:

- `FEATURE_ANALYZE_ENABLED`
- `FEATURE_CLUSTER_ANALYSIS_ENABLED`
- `FEATURE_SUGGEST_ENABLED`
- `FEATURE_NARRATIVE_ENABLED`
- `FEATURE_MINIMAX_ENABLED`
- `FEATURE_HEALTH_PROBES_ENABLED`
- `FEATURE_STRICT_GOVERNANCE_ENABLED`
- `RELEASE_SAFETY_MODE`
- `INCIDENT_ACTIVE`
- `INCIDENT_SEVERITY`
- `INCIDENT_REASON`
- `INCIDENT_STARTED_AT`

Defaults:

- analyze, cluster, suggest, narrative, minimax, health probes: enabled
- strict governance: disabled
- release safety mode: `NORMAL`
- incident: inactive

Env parsing is centralized. Business code does not read `process.env` directly.

## ReleaseReadinessService Rules

First-pass readiness is runtime-oriented, not CI-oriented.

Blockers:

- incident mode is active
- `ANALYZE_ENABLED=false`
- runtime health is `UNHEALTHY`
- connector health is `UNHEALTHY`

Warnings:

- release safety mode is `DEGRADED`
- runtime is `DEGRADED`
- connectors are `DEGRADED` or `UNKNOWN`
- narrative provider is `DEGRADED`, `UNHEALTHY`, or `UNKNOWN`
- suggest is disabled
- cluster analysis is disabled

Important rule:

- narrative or MiniMax degradation is not automatically a release blocker if the rule-only path remains available

## ReleaseGuardService Rules

### Analyze

- `ANALYZE_ENABLED=false` -> reject with `RELEASE_ANALYZE_DISABLED`
- cluster request + `CLUSTER_ANALYSIS_ENABLED=false` -> reject with `RELEASE_CLUSTER_DISABLED`
- incident mode + cluster request -> reject with `RELEASE_INCIDENT_CLUSTER_DISABLED`
- `NARRATIVE_ENABLED=false` -> allow, but disable narrative
- `MINIMAX_ENABLED=false` + narrative requested -> allow, but force `RULE_ONLY`
- `RELEASE_SAFETY_MODE=DEGRADED` + narrative requested -> allow, but force `RULE_ONLY`
- incident mode + narrative requested:
  - `HIGH` / `CRITICAL` -> disable narrative
  - lower severity -> force `RULE_ONLY`

### Suggest

- `SUGGEST_ENABLED=false` -> reject with `RELEASE_SUGGEST_DISABLED`
- incident mode -> reject with `RELEASE_INCIDENT_SUGGEST_DISABLED`

### Important Boundary

- cluster-disabled requests are rejected, not silently rewritten into single-account requests
- narrative disable or rule-only fallback does not change business facts; it only changes runtime execution path

## Release Readiness Endpoint

`GET /api/health/release-readiness`

Returns a stable snapshot with:

- `ready`
- `mode`
- `blockers`
- `warnings`
- `activeSwitches`
- `checkedAt`
- connector/provider/runtime summary status

It does not expose secret env values.

## Observability

Release safety emits:

- `release.guard.evaluated`
- `release.guard.rejected`
- `release.guard.degraded`
- `release.switch.disabled`
- `release.narrative.forced_rule_only`
- `release.readiness.evaluated`
- `incident.mode.active`

Metrics:

- `release.guard_total`
- `release.guard_rejected_total`
- `release.guard_degraded_total`
- `release.switch_disabled_total`
- `release.narrative_forced_rule_only_total`
- `release.readiness_not_ready_total`

## Not In Scope

This step does not implement:

- external flag platforms
- automatic rollback
- alerting
- dashboard-style control UI
- deployment pipeline integration

## Next Step

Stage 6 Step 6 can now validate:

- switch semantics
- release-readiness output
- incident-mode behavior
- route compatibility under reject/degrade paths
