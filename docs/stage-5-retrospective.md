# Stage 5 Retrospective

## Goal Review

Stage 5 goal was to add a controlled LLM narrative layer on top of the existing rule-based portrait engine, while keeping the rules as the factual source of truth and preserving backward compatibility.

What was completed:

- narrative contracts were frozen
- provider abstraction was added with `Disabled`, `RuleOnly`, and `MiniMax`
- prompt building, structured output, parser, and fallback were implemented
- narrative was integrated into `ComposePortraitReport` and `ReportBuilder`
- the `/analyze` result page was upgraded to present narrative and structured facts together
- Stage 5 regression, manual QA, and retrospective artifacts now exist

What was explicitly not in scope:

- new providers
- provider/platform governance
- Weibo OAuth
- prompt tuning infrastructure
- product-grade UI overhaul

## What Has Been Validated

### 1. Narrative contract is valid

- `NarrativeDraft`, `NarrativeSection`, `NarrativeMode`, `NarrativeTone`, `NarrativeAudience`, and fallback semantics are stable enough to support provider and report integration
- `NarrativeSectionCode` is small and controlled
- the optional `narrative` block in `PortraitReport` is backward compatible

### 2. Provider abstraction is valid

- `DisabledNarrativeGateway`, `RuleOnlyNarrativeGateway`, and `MiniMaxNarrativeGateway` have clear boundaries
- timeout, invalid response, and upstream error mapping are explicit
- fallback semantics work without breaking the main analyze flow

### 3. PromptBuilder is valid

- `ComposeNarrativeInput` is grounded in structured facts only
- `NarrativeInputSerializer` keeps the facts block compact and stable
- prompt guardrails explicitly forbid invented facts
- `NarrativeResponseParser` and schema validation reject invalid or under-constrained output

### 4. Narrative integration is valid

- `portrait.summary` now has a stable priority chain:
  - llm short summary if valid
  - rule-only narrative if used
  - existing rule summary fallback
- `headline`, `caveats`, and optional deeper narrative sections coexist with the existing report
- single-account and multi-account narrative paths are both compatible

### 5. Result experience is valid

- narrative is now a reading entry point rather than a hidden debug field
- structured facts remain visible:
  - archetype
  - tags
  - confidence
  - evidence
  - warnings
  - cluster insights
- the result page is more readable without letting narrative replace the fact layer

## Real Problems Exposed

### 1. Prompt quality is still first-pass

- Observation: the current prompt is controlled, but the prose can still feel stiff and sometimes underuses the available structured facts.
- Impact: output is safe and grounded, but not yet product-polished.
- Blocking Stage 6: no.
- Suggested timing: keep the current contract frozen and revisit content quality only if governance needs better operator confidence signals.

### 2. RuleOnly and LLM-assisted still differ in richness

- Observation: `RuleOnly` reliably produces a minimal narrative, but the section set is thinner than successful LLM-assisted output.
- Impact: fallback remains safe, but the experience gap can feel noticeable.
- Blocking Stage 6: no.
- Suggested timing: defer to future experience work, not governance.

### 3. Fallback experience is still a bit engineering-oriented

- Observation: fallback warnings such as `fallback:upstream_error` are deterministic and useful for QA, but still operator-flavored.
- Impact: acceptable for current validation, not ideal for broader product audiences.
- Blocking Stage 6: no.
- Suggested timing: improve copy later without changing fallback semantics.

### 4. low-data / degraded restraint works, but wording is still mechanical

- Observation: the system preserves caution, but some caveat wording remains blunt.
- Impact: safety is good, readability is acceptable, polish is limited.
- Blocking Stage 6: no.
- Suggested timing: treat as later prompt/content refinement, not a contract problem.

### 5. Result-page narrative blocks are still closer to an internal workbench than a final product view

- Observation: the information architecture is improved, but the page is still optimized for correctness and traceability over polish.
- Impact: good for validation and internal usage, not a final consumer experience.
- Blocking Stage 6: no.
- Suggested timing: only revisit after governance and operational needs stabilize.

### 6. Narrative evaluation still depends on golden cases and manual review

- Observation: Stage 5 now has a regression baseline, but it does not yet have a richer prompt-eval platform or automated semantic scoring.
- Impact: changes are safer, but evaluation still depends on curated cases plus operator review.
- Blocking Stage 6: no.
- Suggested timing: governance can proceed with the current baseline; richer eval can come later if narrative iteration becomes frequent.

## Freeze Recommendations Before Stage 6

### Recommend freezing

- `NarrativeDraft` base structure
- `NarrativeSectionCode` set
- `ComposeNarrativeInput` minimum grounded fact set
- `NarrativeStructuredOutput` schema
- `LlmNarrativeGateway` contract
- fallback semantics and error mapping
- optional `narrative` block in `PortraitReport`
- the rule: structured facts are authoritative and LLM only improves expression

### Do not freeze yet

- exact user-facing wording of narrative sections
- visual placement and styling details inside the result page
- richer provider-specific prompt tuning

Reason: these are quality and experience concerns, not structural contracts.

## Stage 6 Entry Conditions

Before Stage 6, the system now has:

- a stable rule-based portrait engine
- a working multi-account aggregated workflow
- an optional narrative layer
- provider and fallback plumbing
- prompt/parser guardrails
- narrative regression and manual QA artifacts

Stage 6 should focus on:

- production governance
- operational configuration and observability
- failure handling policy
- safe provider usage in real environments

Stage 6 should not be repeatedly interrupted by:

- changes to `NarrativeSectionCode`
- changes to the prompt input facts schema
- changes to narrative fallback semantics
- changes to the optional `narrative` block shape in `PortraitReport`

## Non-goals and Deferred Items

- new providers
- advanced prompt tuning platform
- Weibo OAuth
- production governance implementation details
- full product-grade UI overhaul

These remain deferred because Stage 5’s purpose was to make narrative safe, grounded, and integrable, not to widen platform scope or complete operational hardening.

## Final Conclusion

Stage 5 meets its intended goal.

The system now supports:

- grounded narrative contracts
- provider abstraction with safe fallback
- structured prompt and parser guardrails
- optional narrative integration into the final report
- a more readable result page that still exposes structured facts

It is reasonable to enter Stage 6, provided the Stage 5 contracts listed above are treated as frozen and Stage 6 focuses on governance, observability, and runtime safety rather than changing the narrative structure again.
