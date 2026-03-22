# Stage 5 Prompt Builder

## Goal

This step replaces the temporary narrative transport serializer with a formal prompt-generation path:

- `NarrativeInputSerializer`
- `NarrativePromptBuilder`
- `NarrativeStructuredOutput` schema
- `NarrativeResponseParser`

The goal is not better prose quality yet. The goal is stable, grounded, parseable narrative generation.

## PromptBuilder Responsibility

`NarrativePromptBuilder` is responsible for:

- taking `ComposeNarrativeInput`
- serializing only the facts the model actually needs
- enforcing grounded-only instructions
- forcing strict JSON output
- making low-data / degraded / warning scenarios explicitly conservative

It does not:

- make network requests
- parse provider responses
- integrate into `ReportBuilder`

## NarrativeInputSerializer

`NarrativeInputSerializer` compacts `ComposeNarrativeInput` into a controlled facts block.

Current facts block includes:

- scope
  - `isCluster`
  - `accountCount`
  - `activeCommunities`
  - account coverage counts
- portrait facts
  - `archetype`
  - `tags`
  - `confidence`
  - `summaryFallback`
- traits
  - `stableTraits`
  - `communitySpecificTraits`
  - `overlap`
  - `divergence`
- evidence
  - bounded list
  - truncated excerpts
  - stable evidence ids
- quality
  - `degraded`
  - `lowData`
  - compact warnings

It intentionally does not include:

- raw connector output
- HTML
- raw snapshots
- oversized report payloads

## Structured Output Schema

The model is required to return strict JSON with:

- top-level `sections`
- each section has:
  - `code`
  - `content`
  - optional `sourceHints`
  - optional `supportingEvidenceIds`

Current section codes remain bounded by `NarrativeSectionCode`.

Required behavior:

- `HEADLINE`
- `SHORT_SUMMARY`

must exist for normal narrative generation.

`CAVEATS` becomes mandatory when the structured facts indicate:

- degraded source
- low-data
- warnings present

## NarrativeResponseParser

`NarrativeResponseParser` is responsible for:

- removing markdown code fences
- parsing JSON
- validating schema
- enforcing valid section codes
- verifying `supportingEvidenceIds` only reference provided evidence ids
- enforcing `CAVEATS` in degraded/low-data cases
- normalizing text and deduplicating duplicate section codes
- returning a normalized `NarrativeDraft`

If validation fails, it raises `NarrativeGatewayError.INVALID_RESPONSE`.

## Guardrails

The current guardrails are fixed in both prompt construction and parser behavior:

- grounded only
- strict JSON only
- no invented facts
- no invented evidence ids
- conservative output for low-data / degraded / warning-heavy inputs
- no unsupported overlap/divergence claims
- no profession/location/identity/personality speculation

## MiniMax Gateway Upgrade

`MiniMaxNarrativeGateway` now runs:

`ComposeNarrativeInput -> NarrativePromptBuilder -> MiniMax request -> NarrativeResponseParser -> NarrativeGenerationResult`

The old temporary serializer is no longer the main path.

## What This Step Still Does Not Do

- no report integration
- no UI integration
- no prompt tuning
- no few-shot evaluation harness

## Next Steps

### Step 4

- connect `NarrativeGenerationResult` into `ReportBuilder`
- keep fallback behavior unchanged

### Step 5

- improve how narrative sections are surfaced in the result experience

