# Stage 5 Narrative Integration

## Goal

Freeze how `NarrativeGenerationResult` enters the final `PortraitReport` without changing the existing required API envelope.

## Why It Happens Here

Narrative integration belongs in `ComposePortraitReport` and `ReportBuilder`, not in the UI:

- the narrative layer depends on structured facts that already exist in report composition
- summary/headline/caveat priority must be decided once, centrally
- provider failure must fall back safely before the response leaves the backend
- the frontend should consume an already-composed report, not re-run narrative rules

## Source Of Truth Priority

### `portrait.summary`

1. `NarrativeDraft.SHORT_SUMMARY`, if narrative generation succeeds
2. existing rule summary fallback

`portrait.summary` always remains present.

### `headline`

Not promoted into `portrait` directly. It is exposed only through optional `report.narrative.headline`.

### `caveats`

1. `NarrativeDraft.CAVEATS`, if present
2. rule-based fallback caveat generated from:
   - `degraded`
   - `LOW_DATA`
   - low confidence
   - warnings

### `archetype`, `tags`, `confidence`, `evidence`, `stableTraits`, `communitySpecificTraits`, `overlap`, `divergence`

These stay owned by the rule/report layer. Narrative may describe them, but does not replace them.

## Report Shape

Existing required fields remain unchanged:

- `portrait`
- `evidence`
- `metrics`
- `communityBreakdowns`
- `warnings`

This step adds an optional top-level field:

- `narrative?`

`narrative` contains:

- `generatedBy`
- `fallbackUsed`
- `mode`
- `tone`
- `audience`
- `headline?`
- `shortSummary?`
- `deepSummary?`
- `stableTraitsSummary?`
- `communitySpecificSummary?`
- `overlapDivergenceSummary?`
- `caveats?`
- `sections?`
- `warnings?`

Old clients can ignore `narrative` and continue using `portrait.summary`.

## Integration Flow

1. `ComposePortraitReport` builds cluster insights and rule summary
2. it constructs `ComposeNarrativeInput`
3. it resolves a narrative gateway for the requested mode
4. it executes narrative generation with fallback-safe behavior
5. `NarrativeReportMapper` maps `NarrativeGenerationResult` into report fields
6. `ReportBuilder` produces the final `PortraitReport`

## Low-Data / Degraded / Fallback Strategy

- `OFF`: no narrative field is required; `portrait.summary` stays rule-driven
- `RULE_ONLY`: narrative is available without external LLM calls
- `LLM_ASSISTED` success: `portrait.summary` may come from `SHORT_SUMMARY`
- `LLM_ASSISTED` failure: fallback result is accepted and the main flow still succeeds
- degraded / low-data cases must still have a conservative expression path through:
  - rule summary caution
  - `narrative.caveats`
  - or both

## Not Done In This Step

- result page rendering changes
- prompt tuning or prompt evaluation
- narrative quality scoring
- changing `/api/analyze` required fields

## Next Steps

- Stage 5 Step 5 can render `narrative.headline`, `narrative.caveats`, and section summaries
- Stage 5 Step 6 can validate fallback frequency, summary quality, and report compatibility through regression and manual QA
