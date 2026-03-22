# Stage 5 Provider Gateway

## Goal

This step adds the runtime provider plumbing for the narrative layer without introducing prompt tuning, report integration, or UI changes.

It establishes three runnable gateway behaviors:

- disabled
- rule-only
- MiniMax-assisted with fallback

## Provider Structure

The current provider layer is organized around `LlmNarrativeGateway`:

- `DisabledNarrativeGateway`
- `RuleOnlyNarrativeGateway`
- `MiniMaxNarrativeGateway`
- `NarrativeGatewayResolver`
- `FallbackNarrativeGateway`

The resolver owns provider selection. Business code should not scatter provider if-else branches.

## Gateway Responsibilities

### `DisabledNarrativeGateway`

- used for `NarrativeMode.OFF`
- produces no narrative
- performs no network calls
- returns a stable non-error result

### `RuleOnlyNarrativeGateway`

- used for `NarrativeMode.RULE_ONLY`
- also serves as the main fallback when MiniMax is unavailable or fails
- builds a minimal `NarrativeDraft` from rule-grounded facts only
- currently emits:
  - `HEADLINE`
  - `SHORT_SUMMARY`
  - `CAVEATS` when needed

### `MiniMaxNarrativeGateway`

- used for `NarrativeMode.LLM_ASSISTED`
- calls an OpenAI-compatible `chat/completions` endpoint via `fetch`
- expects JSON-only output
- strips code fences and maps provider content into `NarrativeDraft`

## Configuration

Current configuration keys:

- `NARRATIVE_PROVIDER=none|minimax`
- `NARRATIVE_TIMEOUT_MS`
- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`

Behavior:

- provider defaults to `none`
- timeout defaults to `4000ms`
- MiniMax is considered configured only when `apiKey + baseUrl + model` are all present
- missing MiniMax config does not crash the app; resolver falls back to rule-only behavior

## Error Model and Fallback

`NarrativeGatewayError` currently covers:

- `CONFIG_ERROR`
- `TIMEOUT`
- `RATE_LIMITED`
- `UPSTREAM_ERROR`
- `INVALID_RESPONSE`
- `DISABLED`
- `UNSUPPORTED_PROVIDER`

Fallback semantics:

- `OFF` -> `DisabledNarrativeGateway`
- `RULE_ONLY` -> `RuleOnlyNarrativeGateway`
- `LLM_ASSISTED + minimax configured` -> try MiniMax, then fall back according to `NarrativeFallbackPolicy`
- `LLM_ASSISTED + minimax missing/disabled` -> direct fallback behavior without crashing

The narrative layer must never take down the main analysis flow.

## Temporary Transport Serializer

This step intentionally does not implement a formal prompt builder.

Instead, `MiniMaxNarrativeGateway` uses a temporary transport serializer:

- fixed system instruction
- compact JSON facts block

This is temporary by design. Stage 5 Step 3 will replace it with a dedicated `PromptBuilder`.

## Non-goals in This Step

- no prompt tuning
- no few-shot examples
- no report integration
- no UI changes
- no provider-specific result polishing

## How Later Steps Use This

### Step 3

- build a real prompt builder on top of `ComposeNarrativeInput`
- replace the temporary transport serializer

### Step 4

- wire `NarrativeGenerationResult` into `ReportBuilder`
- keep fallback behavior explicit and non-fatal

