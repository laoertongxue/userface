# Stage 4 Merge Suggestion

## Goal

Add a suggestion layer that can inspect multiple candidate accounts and return `MergeSuggestion[]` without automatically merging anything.

This step exists to support later cluster-building workflows while preserving the rule:

- suggestion is advisory
- merge is manual

## Main Flow

The suggestion path is:

1. receive candidate accounts
2. fetch lightweight profile hints only
3. score each cross-community pair
4. filter by confidence threshold
5. sort suggestions stably
6. return suggestions, ignored pairs, and warnings

No `IdentityCluster` fact is created in this step.

## Signal Sources

The first version only uses lightweight identity hints:

- homepage / website
- handle
- displayName
- bio / tagline / signature
- avatar URL

It intentionally does not use:

- replies
- topics
- activity streams
- social graph
- embeddings or semantic search

## First-Pass Scoring Rules

Strong or medium positive signals:

- `homepage-exact-match`
- `handle-exact-match`
- `display-name-match`
- `handle-similar`
- `bio-overlap`
- `avatar-match`

Negative or suppressing signal:

- `conflicting-homepage`

Additional guardrail:

- sparse profile hints reduce confidence

The first version is a weighted heuristic model, not a learned model.

## Thresholds

The first version freezes these boundaries in policy code:

- `MIN_CONFIDENCE_TO_EMIT`
- `STRONG_SUGGESTION_THRESHOLD`

Pairs below the minimum threshold are not emitted as suggestions.
Same-community pairs are ignored by design.

## Why Suggestion Does Not Auto-Merge

This step keeps manual confirmation as the fact source.

- suggestions are candidates
- accepted links must still become explicit `AccountLink` facts later
- rejected suggestions must not mutate cluster state

This prevents the system from silently merging unrelated accounts.

## Current Non-Goals

This step does not implement:

- automatic forced merge
- server-side persistence
- complex ML / embedding / vector retrieval
- front-end cluster builder
- aggregated report upgrade

## How Later Steps Use This

- Stage 4 Step 4 can use accepted suggestions as input to richer aggregated reports.
- Stage 4 Step 5 can call `/api/identity/suggest` from the cluster builder UI.
- Later accepted suggestions may be converted into `AccountLink` facts, but only after explicit confirmation.
