# Stage 6 Manual QA

## Purpose

This is the manual QA document for Stage 6.

Stage 6 goal: ensure the system has a minimum production-governance baseline across observability, request governance, health probes, release readiness, and incident-mode behavior.

Current scope does not include:

- new platform integrations
- UI admin consoles
- automatic rollback
- external alerting systems

## Preconditions

1. Install dependencies: `npm install`
2. Start the app: `npm run dev`
3. Open the app: [http://localhost:3000](http://localhost:3000)
4. Main routes you may call during QA:
   - [http://localhost:3000/analyze](http://localhost:3000/analyze)
   - [http://localhost:3000/api/health/connectors](http://localhost:3000/api/health/connectors)
   - [http://localhost:3000/api/health/narrative](http://localhost:3000/api/health/narrative)
   - [http://localhost:3000/api/health/runtime](http://localhost:3000/api/health/runtime)
   - [http://localhost:3000/api/health/release-readiness](http://localhost:3000/api/health/release-readiness)
5. Prepare `.env.local` only with variables you need for the selected QA case:
   - narrative and provider:
     - `NARRATIVE_PROVIDER`
     - `NARRATIVE_TIMEOUT_MS`
     - `MINIMAX_API_KEY`
     - `MINIMAX_BASE_URL`
     - `MINIMAX_MODEL`
   - feature switches and incident mode:
     - `FEATURE_ANALYZE_ENABLED`
     - `FEATURE_CLUSTER_ANALYSIS_ENABLED`
     - `FEATURE_SUGGEST_ENABLED`
     - `FEATURE_NARRATIVE_ENABLED`
     - `FEATURE_MINIMAX_ENABLED`
     - `FEATURE_HEALTH_PROBES_ENABLED`
     - `FEATURE_STRICT_GOVERNANCE_ENABLED`
     - `RELEASE_SAFETY_MODE`
     - `INCIDENT_ACTIVE`
     - `INCIDENT_SEVERITY`
     - `INCIDENT_REASON`
     - `INCIDENT_STARTED_AT`
   - cron auth:
     - `HEALTH_PROBE_CRON_TOKEN`
     - or `CRON_SECRET`
6. Useful API examples:
   - analyze:
     ```bash
     curl -s -X POST http://localhost:3000/api/analyze \
       -H 'content-type: application/json' \
       -d '{"identity":{"accounts":[{"community":"v2ex","handle":"laoertongzhi"}]},"options":{"locale":"zh-CN"}}'
     ```
   - suggest:
     ```bash
     curl -s -X POST http://localhost:3000/api/identity/suggest \
       -H 'content-type: application/json' \
       -d '{"accounts":[{"community":"v2ex","handle":"laoertongzhi"},{"community":"guozaoke","handle":"tipsy_love"}]}'
     ```
   - cron probe:
     ```bash
     curl -s http://localhost:3000/api/cron/health-probe \
       -H "authorization: Bearer $HEALTH_PROBE_CRON_TOKEN"
     ```

## Coverage

This QA pass covers:

- observability baseline
- request governance
- health probes
- release readiness
- feature switches and incident mode
- regression commands:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

This QA pass does not cover:

- Stage 7 platform expansion
- automatic rollback
- external alerting
- dashboard-style config centers

## Test Matrix

### 1. Analyze normal request

- Input / config:
  - one known-good public account
  - all feature switches enabled
  - incident inactive
- Expected:
  - `/api/analyze` succeeds
  - response keeps existing JSON shape
  - `x-trace-id` exists
- Observe:
  - response status
  - response JSON shape
  - server logs contain structured events
- Pass:
  - analyze succeeds and no governance/release rejection is triggered

### 2. Analyze rate limit

- Input / config:
  - repeat the same analyze request rapidly from the same machine/session
- Expected:
  - repeated requests eventually return governance rejection
  - error code is `GOVERNANCE_RATE_LIMITED`
  - `retryAfterSeconds` is present
- Observe:
  - response status `429`
  - response error structure
  - governance logs and metrics
- Pass:
  - rate-limited request is rejected consistently

### 3. Suggest pair limit

- Input / config:
  - send a suggest request with enough accounts to exceed the pair budget
- Expected:
  - request is rejected before suggestion execution
  - error code is `GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS`
- Observe:
  - response status
  - response error code
  - no downstream suggestion result body
- Pass:
  - request is rejected with the stable governance error

### 4. Narrative budget disable

- Input / config:
  - analyze request with multiple accounts
  - narrative enabled
  - complexity high enough to exceed narrative budget only
- Expected:
  - main analyze flow still succeeds
  - narrative is disabled or downgraded
  - request is marked degraded in observability
- Observe:
  - response still succeeds
  - logs include governance degrade / narrative disable
  - result remains usable
- Pass:
  - analyze completes and narrative cost is safely reduced

### 5. Connector degraded health

- Input / config:
  - use local/mocked conditions or a known degraded probe target
  - call `/api/health/connectors`
- Expected:
  - connector status can become `DEGRADED`
  - warnings are visible
- Observe:
  - `status`
  - `targets`
  - `warnings`
- Pass:
  - degraded connector health is visible and structured

### 6. Provider fallback health

- Input / config:
  - enable narrative
  - misconfigure or intentionally disable MiniMax while RuleOnly remains available
  - call `/api/health/narrative`
- Expected:
  - provider status is `DEGRADED` or `UNKNOWN`, not falsely `HEALTHY`
  - fallback capability remains understandable
- Observe:
  - provider targets
  - warnings
  - release readiness warnings if checked
- Pass:
  - provider degradation is visible without misreporting health

### 7. Runtime unhealthy

- Input / config:
  - set `NARRATIVE_PROVIDER=minimax` without the required MiniMax config
  - call `/api/health/runtime`
- Expected:
  - runtime status becomes `UNHEALTHY`
  - blockers explain the missing runtime requirement
  - secrets are not exposed
- Observe:
  - runtime `status`
  - `blockers`
  - absence of secret env values in JSON
- Pass:
  - runtime self-check detects the blocker safely

### 8. Release readiness not ready

- Input / config:
  - set `INCIDENT_ACTIVE=true`
  - or set `FEATURE_ANALYZE_ENABLED=false`
  - call `/api/health/release-readiness`
- Expected:
  - `ready=false`
  - blockers are not empty
  - active switches are visible
- Observe:
  - `ready`
  - `blockers`
  - `warnings`
  - `activeSwitches`
- Pass:
  - readiness endpoint clearly shows the system is not ready

### 9. Incident mode closes cluster and suggest

- Input / config:
  - `INCIDENT_ACTIVE=true`
  - set `INCIDENT_SEVERITY=HIGH`
  - call:
    - cluster analyze
    - single-account analyze
    - suggest
- Expected:
  - cluster analyze is rejected
  - suggest is rejected
  - single-account analyze still runs, but narrative may be disabled or forced to RuleOnly
- Observe:
  - rejection payloads for cluster/suggest
  - single-account analyze response still succeeds
- Pass:
  - incident mode contracts service surface safely and predictably

### 10. Regression commands

- Run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Expected:
  - all three pass
- Pass:
  - Stage 6 retains a stable engineering baseline

## QA Record Template

- Case name:
- Route / module:
- Input / configuration:
- Result: `Pass` / `Fail`
- Notes:
- Log or screenshot path:

## Exit Criteria

Stage 6 manual QA passes when:

1. observability baseline is visible and stable
2. request governance rejects and degrades the right requests
3. health probes return stable, safe structures
4. release readiness shows accurate blockers and warnings
5. feature switches and incident mode are verifiable end to end
6. `npm run typecheck`, `npm test`, and `npm run build` all pass
