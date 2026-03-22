# Stage 4 Retrospective

## Goal Review

Stage 4 goal was to expand the system from single-account analysis into a multi-account, multi-community workflow without introducing automatic merge, server-side persistence, or a new API shape.

What was completed:

- `IdentityCluster` and related contracts were frozen
- multi-account fetching, merge, dedupe, partial-success, and all-failed handling were implemented
- suggestion was added as a separate, non-authoritative layer
- aggregated report fields were added in a backward-compatible way
- `/analyze` now supports `SINGLE_ACCOUNT` and `MANUAL_CLUSTER`
- Stage 4 regression, manual QA, and retrospective artifacts now exist

What was explicitly not in scope:

- automatic merge
- server-side profile persistence
- LLM narrative
- production governance
- Weibo OAuth
- product-grade UI redesign

## What Has Been Validated

### 1. IdentityCluster workflow is valid

- `IdentityCluster` works as the analysis subject for both one account and many accounts
- manual aggregation remains the primary fact source
- `MergeSuggestion` stays advisory only
- single-account compatibility still holds

### 2. Multi-account orchestration is valid

- the main path now supports fetch-many, merge, dedupe, partial success, and all-failed semantics
- duplicate `community + handle` input does not inflate fetches or metrics
- at least one successful account is enough to continue analysis
- all-failed is explicit and does not produce a fake empty report

### 3. Suggestion is valid as a separate layer

- `/api/identity/suggest` returns confidence-ordered suggestions with reasons
- suggestion does not mutate `IdentityCluster` facts
- frontend accept/reject decisions stay local-only

### 4. Aggregated report is valid

- `stableTraits`
- `communitySpecificTraits`
- `overlap / divergence`
- `cluster confidence`
- `account coverage`

are now available as optional cluster-aware fields without breaking the existing report structure.

### 5. Frontend workflow is valid

- `/analyze` now supports single-account and manual-cluster modes
- cluster draft editing, suggestion review, and aggregated analyze are all operable from one page
- localStorage persistence works without introducing server-side state

## Real Problems Exposed

### 1. Manual input is still the main discovery mechanism

- Observation: users still need to know or guess which accounts to include.
- Impact: aggregated analysis quality depends on user input quality.
- Blocking Stage 5: no.
- Suggested timing: keep as-is for Stage 5; revisit only if workflow discovery becomes the main bottleneck.

### 2. Suggestion remains heuristic

- Observation: homepage, handle, display name, bio, and avatar hints are useful but not authoritative.
- Impact: false positives and false negatives remain possible.
- Blocking Stage 5: no, as long as “suggestion is not fact” stays frozen.
- Suggested timing: refine only after Stage 5 experience identifies repeated failure modes.

### 3. Aggregated report fields are structurally useful but still operator-oriented

- Observation: cluster report fields are stable, but the UI presentation is still closer to an internal workbench than a polished product.
- Impact: engineering teams can inspect results, but end-user readability is still limited.
- Blocking Stage 5: no.
- Suggested timing: Stage 5 should focus on narrative and result experience instead of reworking the contracts again.

### 4. localStorage draft is device-local only

- Observation: draft persistence is intentionally local-only.
- Impact: no cross-device continuity and no team handoff via backend state.
- Blocking Stage 5: no.
- Suggested timing: defer until a production governance phase that can address persistence policy safely.

### 5. all-failed and degraded states are still expressed in engineering language

- Observation: the backend semantics are correct, but the frontend wording is still closer to debugging output.
- Impact: usable for validation, not ideal for broader audiences.
- Blocking Stage 5: no.
- Suggested timing: improve wording in Stage 5 without changing the underlying failure semantics.

### 6. Cluster contracts should stop moving before Stage 5

- Observation: the Stage 4 contracts are now broad enough for the current workflow.
- Impact: changing them again during Stage 5 would destabilize both frontend and regression baselines.
- Blocking Stage 5: yes, if the contracts keep drifting.
- Suggested timing: freeze now; only allow compatibility-safe additions.

## Freeze Recommendations Before Stage 5

### Recommend freezing

- `IdentityCluster` base structure
- `ClusterAccountRef`, `AccountLink`, and `MergeSuggestion` base shapes
- multi-account `identity.accounts[]` request shape for `/api/analyze`
- `/api/identity/suggest` base request/response contract
- optional `cluster` report block structure
- `accountCoverage` base structure
- local draft base structure in localStorage
- the rule: suggestion is advisory only and never auto-merges

### Do not freeze yet

- exact wording of UI labels and summaries
- visual grouping of cluster sections in the page
- operator-facing copy for degraded/all-failed states

Reason: these are presentation concerns and can still improve in Stage 5 without destabilizing backend or application contracts.

## Stage 5 Entry Conditions

Before Stage 5, the system now has:

- dual-platform single-account analysis
- multi-account cluster orchestration
- suggestion capability
- aggregated report output
- a local-only cluster builder workflow
- Stage 4 regression coverage and manual QA documentation

Stage 5 should focus on:

- narrative and result experience
- better operator readability of aggregated findings
- polishing how cluster insights are surfaced, not redefining their meaning

Stage 5 should not be interrupted by repeated changes to:

- `IdentityCluster` contract
- suggestion contract
- aggregated report field structure
- request shapes for single-account vs cluster analysis

## Non-goals and Deferred Items

- automatic forced merge
- server-side persistent profile archives
- LLM narrative
- Weibo OAuth
- production governance
- product-grade UI redesign

These remain deferred because Stage 4’s purpose was to establish a stable aggregated workflow, not to widen platform scope or add operational complexity.

## Final Conclusion

Stage 4 meets its intended goal.

The system now supports:

- manual cluster construction
- multi-account backend orchestration
- suggestion as a non-authoritative helper
- cluster-aware report output
- a usable local-only frontend workflow

It is reasonable to enter Stage 5, provided the Stage 4 contracts listed above are treated as frozen and Stage 5 focuses on narrative/readability improvements rather than reworking the workflow foundation.

