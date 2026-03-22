# Stage 5 Result Experience

## Goal

Upgrade the `/analyze` result area from a debug-oriented output block into a clearer reading flow, without changing the backend contract.

## Result Information Architecture

The page now follows this reading order:

1. `NarrativeSummaryPanel`
   - headline
   - short summary
   - archetype
   - top tags
   - portrait confidence
   - cluster confidence when relevant
2. `CaveatsPanel`
   - narrative caveats
   - warnings
   - low-data / degraded fallback caution
3. `ClusterInsightsPanel`
   - stable traits
   - community-specific traits
   - overlap / divergence
   - cluster confidence
   - account coverage
4. `EvidencePanel`
   - representative evidence list with links
5. `StructuredMetricsPanel`
   - key metrics that stay visible as fact anchors
6. `CommunityInsightsPanel`
   - existing `communityBreakdowns` compatibility block

## Narrative vs Structured Fields

Display priority is:

1. narrative headline / short summary
2. caveats and warnings
3. stable / community-specific traits
4. evidence
5. metrics and community breakdowns

This keeps narrative as the reading entry point, but does not let it replace facts.

Rules:

- `portrait.summary` remains the fallback when narrative is absent
- warnings stay visible even when narrative exists
- evidence is always rendered as a first-class section
- cluster-only sections hide gracefully when the data is not meaningful

## Single-Account vs Multi-Account

### Single account

- summary stays compact
- stable traits may still appear
- overlap / divergence and coverage blocks stay hidden unless they add signal
- the page avoids large empty cluster-only regions

### Manual cluster

- hero block clearly indicates aggregated analysis
- cluster traits, overlap / divergence, confidence, and account coverage become visible
- evidence and warnings remain visible instead of being buried under narrative

## Why Warnings, Caveats, and Evidence Stay Visible

These sections remain explicit because they are the main guardrails against over-reading LLM text:

- warnings surface acquisition limits and degraded fetches
- caveats keep low-data / degraded interpretation conservative
- evidence remains the traceable fact layer behind the summary

## Not Done In This Step

- large-scale UI redesign
- charts
- advanced interaction patterns
- new backend fields
- prompt or provider changes

## Next Step

Stage 5 Step 6 can validate this layout through manual QA and regression checks, focusing on:

- narrative-first readability
- single-account and multi-account compatibility
- caveat / warning visibility
- evidence discoverability
