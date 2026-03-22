# Stage 4 Cluster Orchestration

## Goal

Turn `IdentityCluster.accounts[]` into a real analysis path that can:

- fetch multiple account snapshots
- merge successful results
- dedupe cluster-level activities
- continue through the existing portrait engine

This step keeps the external `/api/analyze` response shape unchanged.

## Main Flow

The cluster analysis path is now:

1. `ResolveIdentityCluster`
2. `FetchIdentityClusterSnapshots`
3. `ClusterSnapshotMergeService`
4. `ActivityDeduplicationService`
5. `AnalyzeIdentityCluster`
6. `ComposePortraitReport`

Single-account analysis uses the same flow with `accounts.length = 1`.

## FetchIdentityClusterSnapshots

Responsibility:

- accept an `IdentityCluster`
- dedupe repeated `community + handle` inputs before fetch
- fetch each account snapshot through the existing connector registry
- keep successful and failed accounts separate
- expose cluster-level degraded state

Current behavior:

- bounded concurrency is small and fixed
- connector-local rate limiting still applies
- if at least one account succeeds, analysis can continue
- if all accounts fail, the pipeline stops with an explicit failure

Returned structure includes:

- `successfulSnapshots`
- `failedAccounts`
- `totalAccounts`
- `successfulCount`
- `failedCount`
- `degraded`

## ClusterSnapshotMergeService

Responsibility:

- merge successful account snapshots into one cluster-level input
- keep per-account profile coverage
- keep per-account warning/degraded state
- build cluster-level warnings
- expose `activeCommunities`

This service does not perform portrait rules or report mapping.

## ActivityDeduplicationService

Responsibility:

- remove duplicate `CanonicalActivity` entries before feature extraction
- keep ordering stable
- prefer the richer copy when duplicates collide

First-pass dedupe rules:

1. same `CanonicalActivity.id`
2. same `community + url + type`
3. same `community + normalized excerpt + publishedAt + type`

This step does not do semantic clustering or cross-community “same topic” inference.

## Failure Semantics

### Duplicate Accounts

- repeated `community + handle` accounts are fetched once
- repeated accounts are counted once
- duplicates do not fail the request

### Partial Success

- if at least one account succeeds, the cluster can still be analyzed
- the merged result is marked degraded
- warnings are preserved for failed accounts

### All Failed

- no pseudo report is generated
- the pipeline stops with an explicit failure

### Profile But No Activities

- not treated as a hard failure
- the account remains in cluster coverage
- low-data and confidence rules handle the result later

## Why This Step Does Not Do More

This step intentionally does not implement:

- merge suggestion logic
- aggregated report redesign
- front-end cluster builder

Those steps now have a stable backend orchestration path to build on.

## How Later Steps Use This

- Stage 4 Step 3 uses the same cluster execution path as the target for `MergeSuggestion` acceptance.
- Stage 4 Step 4 reuses merged account coverage, cluster warnings, and deduped activities for aggregated report shaping.
- Stage 4 Step 5 can submit multi-account `identity.accounts[]` without requiring a second backend pipeline.
