# Stage 4 Identity Workflow

## Goal

Freeze the aggregation contract before implementing multi-account orchestration, merge suggestions, or a cluster builder UI.

This step defines the language and internal contracts for a single analysis subject that can contain one or more community accounts, while keeping the existing single-account flow compatible.

## Why Freeze Contract First

- Multi-account fetching, suggestion generation, and UI editing all depend on the same subject model.
- If `IdentityCluster` remains informal, later steps will keep changing request meaning and link semantics.
- A stable contract lets Stage 4 split work cleanly:
  - Step 2: multi-account orchestration
  - Step 3: merge suggestion generation
  - Step 4: aggregated report upgrade
  - Step 5: cluster builder UI

## Core Terms

### IdentityCluster

A logical analysis subject composed of one or more community accounts.

- Not a database user
- Not a login identity
- Not a persisted server-side profile
- Valid for both single-account and manual multi-account analysis

### ClusterAccountRef

A member account inside an `IdentityCluster`.

- Primary identity fields: `community`, `handle`
- Optional helper fields: `uid`, `homepageUrl`, `displayName`
- No platform HTML, selector, or social-graph fields

### AccountLink

A factual relationship between two accounts inside a cluster.

Supported sources:

- `MANUAL_CONFIRMED`
- `USER_ASSERTED`
- `SUGGESTED`
- `IMPORTED`

Current stage treats `MANUAL_CONFIRMED` and `USER_ASSERTED` as the main fact sources.

### MergeSuggestion

A system-generated possibility that multiple accounts may belong to the same subject.

- Suggestion is not fact
- Suggestion does not create or mutate an `IdentityCluster` by itself
- Suggestion must be confirmed before it becomes an `AccountLink`

### ClusterAnalysisMode

Frozen minimal modes:

- `SINGLE_ACCOUNT`
- `MANUAL_CLUSTER`

### ClusterAnalysisScope

Frozen minimal scopes:

- `PER_ACCOUNT_ONLY`
- `AGGREGATED_ONLY`
- `AGGREGATED_WITH_BREAKDOWN`

## Manual Aggregation First

The model freezes the following rules:

1. The system does not auto-merge accounts into one cluster.
2. Suggestions are advisory only.
3. Fact-source priority is:
   - `MANUAL_CONFIRMED`
   - `USER_ASSERTED`
   - `IMPORTED`
   - `SUGGESTED`
4. Single-account analysis remains valid.
5. An `IdentityCluster` containing exactly one account is valid and expected.

## Current Non-Goals

- Automatic merge suggestion algorithm
- Multi-account fetch orchestration
- Cluster builder UI
- Server-side persistence of user profiles
- Automatic forced merge of accounts

## How Later Steps Use This Contract

- Stage 4 Step 2 uses `IdentityCluster.accounts`, `mode`, and `scope` for multi-account analysis orchestration.
- Stage 4 Step 3 uses `MergeSuggestion` and `AccountLinkSource.SUGGESTED` for suggestion workflows.
- Stage 4 Step 4 uses `ClusterAnalysisScope.AGGREGATED_WITH_BREAKDOWN` and `primaryAccountRef` for aggregated report shaping.
- Stage 4 Step 5 uses the same cluster model in the UI without changing the underlying subject semantics.
