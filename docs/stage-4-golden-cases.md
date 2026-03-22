# Stage 4 Golden Cases

## Purpose

This document freezes the Stage 4 regression baseline for the multi-account, multi-community workflow. These cases are stable, network-free inputs used to guard orchestration, aggregated report output, and the local-only cluster workflow boundary.

## Scope

The golden cases cover:

- single-account compatibility
- same-community multi-account orchestration
- cross-community aggregated analysis
- duplicate account input
- partial success
- all-failed handling
- suggestion-assisted local workflow

They do not cover:

- live crawling
- automatic merge
- frontend visual polish
- LLM narrative output

## Cases

### `single-account-compatible`

- Purpose: keep the cluster-aware pipeline backward compatible with the original single-account flow.
- Input: `IdentityCluster` with one `v2ex` account.
- Expected boundary:
  - analysis succeeds
  - `portrait / evidence / metrics / communityBreakdowns / warnings` remain available
  - `cluster` may exist, but `overlap / divergence` stay empty
  - `accountCoverage.successfulCount = 1`

### `dual-account-same-community`

- Purpose: verify same-community multi-account orchestration, merge, dedupe, and coverage.
- Input: two `v2ex` accounts with different handles.
- Expected boundary:
  - analysis succeeds
  - both accounts are fetched once
  - merged activities are counted once per source activity
  - `activeCommunities = ['v2ex']`
  - `communityBreakdowns` remains stable
  - `accountCoverage.successfulCount = 2`

### `dual-account-cross-community`

- Purpose: exercise the full aggregated report path across `v2ex` and `guozaoke`.
- Input: one `v2ex` account and one `guozaoke` account, both successful.
- Expected boundary:
  - analysis succeeds
  - `activeCommunities = ['guozaoke', 'v2ex']`
  - `stableTraits` exists
  - `communitySpecificTraits` exists for both communities
  - `overlap` and `divergence` both have minimal non-empty output
  - `cluster.confidence` exists
  - `accountCoverage.successfulCount = 2`

### `duplicate-account-input`

- Purpose: ensure duplicate `community + handle` input does not inflate fetches, metrics, or coverage.
- Input: the same `v2ex` account submitted twice with whitespace/case variation.
- Expected boundary:
  - only one unique fetch happens
  - only one account is counted in `requestedAccounts`
  - report metrics do not inflate
  - no workflow error is raised

### `partial-success-cluster`

- Purpose: keep cluster analysis available when at least one account succeeds.
- Input: one successful `v2ex` account, one failed `guozaoke` account.
- Expected boundary:
  - report is still generated
  - degraded behavior is visible through warnings and lower cluster confidence
  - `accountCoverage.successfulCount = 1`
  - `accountCoverage.failedCount = 1`
  - report stays cautious rather than pretending full coverage

### `all-failed-cluster`

- Purpose: keep the failure boundary explicit when no snapshot is available.
- Input: every account fails or resolves to a not-found failure.
- Expected boundary:
  - no report is generated
  - failure is explicit
  - workflow does not silently degrade into an empty success result

### `suggestion-assisted-workflow`

- Purpose: lock the boundary between suggestion review and cluster analysis.
- Input: local draft with multiple accounts, suggestion results, and local `ACCEPTED / REJECTED` decisions.
- Expected boundary:
  - suggestion decisions stay local-only
  - analyze requests still submit only the current `accounts[]`
  - no suggestion decision creates `IdentityCluster` or `AccountLink` facts on the backend

## Automated Coverage

Stage 4 automated regression currently covers:

- cluster orchestration and all-failed/partial-success boundaries
- aggregated report output and account coverage
- local draft persistence, dedupe, and request-shape stability

The current frontend automated coverage is helper-level only. The repo does not maintain a browser/component test harness, so richer interaction verification remains part of manual QA.

