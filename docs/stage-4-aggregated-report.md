# Stage 4 Aggregated Report

## Goal

This step upgrades report composition so a multi-account analysis can expose cluster-aware results without breaking the existing `/api/analyze` envelope.

## Why report first

The cluster builder UI is not the source of truth for aggregation. The backend report contract has to settle first so the next step can consume a stable shape for:

- stable traits
- community-specific traits
- overlap and divergence
- cluster-level confidence
- account coverage

## New cluster concepts

The existing top-level fields remain:

- `portrait`
- `evidence`
- `metrics`
- `communityBreakdowns`
- `warnings`

`PortraitReport` now also allows an optional `cluster` object with:

- `stableTraits`
- `communitySpecificTraits`
- `overlap`
- `divergence`
- `confidence`
- `accountCoverage`

Single-account requests may return a minimal cluster section. Multi-account requests should return the fuller structure.

## Source priority

### `stableTraits`

Priority:

1. `CrossCommunitySynthesisService.stableTraits`
2. global tags
3. minimal fallback from the current tag set

### `communitySpecificTraits`

Priority:

1. `CrossCommunitySynthesisService.communityInsights`
2. per-community metrics already derived into the synthesis layer

These traits are intentionally separate from `communityBreakdowns`. They are for future cluster-aware product work, not for legacy page compatibility.

### `overlap` / `divergence`

Priority:

1. cluster-aware synthesis and stable traits
2. community-specific trait differences

The first version is intentionally conservative: it emits a small number of structured insights instead of trying to narrate every difference.

### `cluster.confidence`

Priority:

1. `ConfidenceProfile.overall`
2. account coverage ratio
3. evidence coverage
4. active community count
5. failed-account and degraded penalties

This is a cluster-level rollup, not a raw average of per-account confidence values.

### `accountCoverage`

Priority:

1. cluster orchestration result (`FetchIdentityClusterSnapshots`)
2. `ClusterMergeResult`
3. `IdentityCluster.accounts` as the requested source of truth

The report layer does not guess coverage from evidence or breakdowns.

## Compatibility strategy

### Single-account

- existing report fields stay usable
- `cluster` may exist, but it stays minimal
- `overlap` and `divergence` are usually empty

### Multi-account

- existing report fields still stay usable
- `cluster` becomes the richer aggregation surface
- `communityBreakdowns` remains for backward compatibility

## What this step does not do

- no front-end Cluster Builder
- no automatic suggestion acceptance
- no new connector behavior
- no LLM narrative layer
- no `/api/analyze` top-level shape redesign

## Next step

Stage 4 Step 5 can now consume:

- `cluster.stableTraits`
- `cluster.communitySpecificTraits`
- `cluster.overlap`
- `cluster.divergence`
- `cluster.confidence`
- `cluster.accountCoverage`

without needing to redefine backend report semantics.
