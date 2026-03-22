# Stage 5 Golden Cases

## Purpose

This document freezes the Stage 5 regression baseline for the LLM narrative layer.

These cases are network-free, deterministic inputs used to guard:

- prompt and serializer structure
- parser and gateway behavior
- fallback safety
- narrative integration into the final report
- result-page compatibility

## Scope

The golden cases cover:

- rule-only single-account narrative
- llm-assisted single-account narrative
- low-data narrative
- degraded-source narrative
- multi-community narrative
- invalid provider output
- missing caveat on degraded input
- provider timeout and upstream failure fallback

They do not cover:

- live MiniMax quality
- prompt tuning or few-shot experiments
- UI polish judgments
- new providers

## Cases

### `rule-only-single-account`

- Purpose: keep the rule-only narrative path stable for a normal single-account sample.
- Input: `ComposeNarrativeInput` with `mode = RULE_ONLY`, one account, adequate data, one representative evidence item.
- Expected boundary:
  - `HEADLINE` and `SHORT_SUMMARY` exist
  - no LLM call is required
  - generated result is grounded in the existing rule summary and tags
  - no invented tags or archetype changes

### `llm-assisted-single-account`

- Purpose: lock the happy path for structured LLM narrative generation.
- Input: `ComposeNarrativeInput` with `mode = LLM_ASSISTED`, one account, valid structured provider output.
- Expected boundary:
  - `HEADLINE` and `SHORT_SUMMARY` exist
  - `DEEP_SUMMARY` may exist
  - `generatedBy = LLM_ASSISTED`
  - `portrait.summary` is driven by `narrative.shortSummary`
  - narrative sections remain schema-valid and evidence-grounded

### `low-data`

- Purpose: ensure weak samples stay conservative.
- Input: low activity volume, low active days, low confidence, `LOW_DATA` warning/trait.
- Expected boundary:
  - `CAVEATS` is mandatory
  - summary remains cautious
  - no overconfident narrative phrasing
  - fallback path still keeps a visible caveat

### `degraded-source`

- Purpose: keep degraded or partial-result narrative stable.
- Input: `degraded = true`, warnings present, partial cluster coverage.
- Expected boundary:
  - caveat path exists in both llm-assisted and fallback flows
  - warnings remain visible alongside narrative
  - degraded state is not hidden by a cleaner headline

### `multi-community`

- Purpose: verify cluster-aware narrative stays aligned with structured cluster facts.
- Input: stable traits, community-specific traits, overlap, divergence, and account coverage all present.
- Expected boundary:
  - stable traits and community-specific traits are described separately
  - overlap/divergence only appear when supported by facts
  - community-specific findings are not promoted into global facts
  - cluster-aware summaries remain compatible with the existing report

### `parser-invalid-output`

- Purpose: keep invalid provider output from leaking upward.
- Input: non-JSON or schema-invalid provider content.
- Expected boundary:
  - parser fails deterministically
  - failure is mapped to `INVALID_RESPONSE`
  - fallback path can recover without fatal error

### `missing-caveat-in-degraded`

- Purpose: prevent degraded narrative from silently omitting caution.
- Input: degraded facts, provider output missing `CAVEATS`.
- Expected boundary:
  - parser rejects the output or forces fallback
  - the final report still preserves a caution path

### `provider-timeout`

- Purpose: guarantee timeout safety.
- Input: MiniMax request aborted by timeout.
- Expected boundary:
  - timeout maps to `TIMEOUT`
  - fallback runs
  - generated result becomes `RULE_ONLY`
  - main report flow stays alive

### `provider-upstream-error`

- Purpose: guarantee upstream failure safety.
- Input: provider returns 5xx.
- Expected boundary:
  - upstream error maps to `UPSTREAM_ERROR`
  - fallback runs
  - summary remains available
  - warnings remain inspectable

## Automated Coverage

Stage 5 automated regression now covers:

- prompt / serializer stability and guardrails
- parser / gateway success and failure semantics
- summary / caveat / fallback integration into `PortraitReport`
- result-page rendering compatibility via server-side markup tests

The current UI regression remains minimal and structure-focused. It verifies compatibility and information hierarchy, not narrative quality or visual polish.
