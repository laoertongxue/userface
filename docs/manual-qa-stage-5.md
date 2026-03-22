# Stage 5 Manual QA

## Purpose

This is the manual QA document for Stage 5.

Stage 5 goal: introduce a controlled narrative layer and a more readable result experience without replacing the rule-based fact layer.

Current scope includes:

- rule-only narrative
- llm-assisted narrative
- fallback narrative
- low-data / degraded caveats
- single-account and multi-account narrative rendering

Current scope does not include:

- production governance
- Weibo OAuth
- new platform expansion
- advanced prompt tuning operations

## Preconditions

1. Install dependencies: `npm install`
2. Start the app: `npm run dev`
3. Open the app: [http://localhost:3000](http://localhost:3000)
4. Open the analyze page: [http://localhost:3000/analyze](http://localhost:3000/analyze)
5. Confirm `POST /api/analyze` works by running one known-good analysis
6. If you want `LLM_ASSISTED` coverage, confirm the following environment variables are available in your local setup:
   - `NARRATIVE_PROVIDER`
   - `NARRATIVE_TIMEOUT_MS`
   - `MINIMAX_API_KEY`
   - `MINIMAX_BASE_URL`
   - `MINIMAX_MODEL`
7. If those variables are absent, `RULE_ONLY` coverage is still valid and LLM fallback behavior should be verified instead

## Coverage

This QA pass covers:

- rule-only narrative
- llm-assisted narrative
- llm fallback to rule-only
- low-data / degraded narrative restraint
- single-account and multi-account narrative compatibility
- result-page rendering of narrative plus structured facts
- regression commands: `npm run typecheck`, `npm test`, `npm run build`

This QA pass does not cover:

- prompt tuning experiments
- provider performance benchmarking
- production monitoring
- new providers
- new platforms

## Test Matrix

### 1. RuleOnly single-account narrative

- Input: one known-good account
- Mode / provider:
  - narrative mode: `RULE_ONLY`
  - provider: disabled or unset
- Expected:
  - result renders successfully
  - `headline` and `short summary` are visible in the result hero block
  - `portrait.summary` is still available
  - no external LLM dependency is required
- Observe:
  - top summary block
  - narrative metadata if exposed
  - evidence and metrics remain visible
- Pass:
  - narrative is present and grounded, with no provider dependency

### 2. LLM-assisted single-account narrative

- Input: one known-good account
- Mode / provider:
  - narrative mode: `LLM_ASSISTED`
  - provider: `minimax`
- Expected:
  - result renders successfully
  - `headline` and `short summary` are visible
  - `portrait.summary` matches or closely follows `narrative.shortSummary`
  - evidence, metrics, and warnings still remain visible
- Observe:
  - summary hero block
  - caveats/warnings block
  - evidence block
- Pass:
  - llm-assisted narrative appears without displacing structured facts

### 3. LLM-assisted fallback to RuleOnly

- Input: one account with provider intentionally misconfigured or temporarily unavailable
- Mode / provider:
  - narrative mode: `LLM_ASSISTED`
  - provider: `minimax`
- Expected:
  - main analyze flow still succeeds
  - result still includes usable summary text
  - fallback warning or equivalent signal is observable
  - no fatal page error
- Observe:
  - summary block
  - narrative metadata if exposed
  - warnings / caveats block
- Pass:
  - fallback is visible and the main report remains usable

### 4. low-data narrative restraint

- Input: an account with clearly limited public activity
- Mode / provider:
  - test with `RULE_ONLY`
  - optional repeat with `LLM_ASSISTED`
- Expected:
  - caveat is clearly visible
  - summary language stays cautious
  - no strong trait overclaim appears
- Observe:
  - hero summary block
  - caveats block
  - portrait confidence / warnings
- Pass:
  - result clearly communicates uncertainty

### 5. degraded narrative restraint

- Input: an account or cluster likely to trigger partial results or degraded warnings
- Mode / provider:
  - test with `RULE_ONLY`
  - optional repeat with `LLM_ASSISTED`
- Expected:
  - warnings remain visible
  - caveats remain visible
  - narrative does not hide degraded behavior
- Observe:
  - caveats block
  - warnings list
  - account coverage if cluster mode is used
- Pass:
  - degraded context is visible even when narrative is readable

### 6. Multi-account narrative

- Input: one `v2ex` account plus one `guozaoke` account
- Mode / provider:
  - `MANUAL_CLUSTER`
  - narrative mode: `RULE_ONLY` or `LLM_ASSISTED`
- Expected:
  - stable traits can be read separately from community-specific traits
  - overlap / divergence is visible when facts support it
  - account coverage remains visible
  - evidence remains visible
- Observe:
  - cluster insights block
  - community breakdowns block
  - evidence block
- Pass:
  - cluster-aware narrative and cluster-aware structured facts coexist cleanly

### 7. UI narrative rendering compatibility

- Input: one single-account run and one multi-account run
- Expected:
  - result page renders with or without `narrative`
  - `headline / short summary` are prioritized
  - `warnings / caveats / evidence` remain visible
  - empty cluster-only sections do not create broken layout
- Observe:
  - full result page layout in both modes
- Pass:
  - UI remains readable and backward compatible

### 8. Regression commands

- Run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Expected:
  - all three pass
- Pass:
  - Stage 5 has a releasable engineering baseline

## QA Record Template

- Case name:
- Mode:
- Input:
- Narrative mode / provider:
- Result: `Pass` / `Fail`
- Notes:
- Screenshot or log path:

## Exit Criteria

Stage 5 manual QA passes when:

1. `RULE_ONLY` and `LLM_ASSISTED` both run in their expected environments
2. fallback can trigger without breaking the main flow
3. low-data and degraded samples preserve caution
4. narrative and structured facts do not conflict
5. `npm run typecheck`, `npm test`, and `npm run build` all pass
