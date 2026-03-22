# Stage 4 Manual QA

## Purpose

This is the manual QA document for Stage 4.

Stage 4 goal: the multi-community aggregated portrait workflow is operational.

Current scope includes:

- single-account compatibility
- manual multi-account cluster building
- identity suggestion request and local review
- aggregated analyze request
- aggregated report output

Current scope does not include:

- LLM narrative
- Weibo OAuth
- production governance
- product-grade UI polish

## Preconditions

1. Install dependencies: `npm install`
2. Start the app: `npm run dev`
3. Open the app: [http://localhost:3000](http://localhost:3000)
4. Open the analyze page: [http://localhost:3000/analyze](http://localhost:3000/analyze)
5. Confirm `POST /api/analyze` works by running one known-good single-account analysis in the page
6. Confirm `POST /api/identity/suggest` works by using the cluster mode "获取关联建议" button with at least two accounts
7. No extra environment variables are required beyond the existing local development setup

## Coverage

This QA pass covers:

- single-account compatibility
- manual cluster building with multiple accounts
- suggestion fetch and local accept/reject
- aggregated analyze request execution
- aggregated report display
- localStorage draft persistence
- regression commands: `npm run typecheck`, `npm test`, `npm run build`

This QA pass does not cover:

- automatic merge
- server-side persistence
- share/export flows
- LLM output
- Weibo

## Test Matrix

### 1. Single-account compatibility happy path

- Mode: `SINGLE_ACCOUNT`
- Input: one real V2EX or guozaoke account
- Steps:
  - open `/analyze`
  - keep `SINGLE_ACCOUNT`
  - select platform
  - enter handle
  - click analyze
- Expected:
  - loading is visible
  - result renders successfully
  - `portrait / evidence / metrics / communityBreakdowns / warnings` are usable
  - page does not require any cluster-specific input
- Pass:
  - single-account analysis still behaves like the pre-cluster path

### 2. Dual-account same-community aggregated happy path

- Mode: `MANUAL_CLUSTER`
- Input: two different handles from the same community
- Steps:
  - switch to `MANUAL_CLUSTER`
  - add two accounts
  - keep both in the same community
  - click analyze
- Expected:
  - report succeeds
  - `communityBreakdowns` remains visible
  - `cluster.accountCoverage.successfulCount = 2`
  - no duplicate inflation in metrics
- Pass:
  - multi-account same-community aggregation completes without breaking the report

### 3. Dual-account cross-community aggregated happy path

- Mode: `MANUAL_CLUSTER`
- Input: one V2EX account and one guozaoke account
- Steps:
  - switch to `MANUAL_CLUSTER`
  - add one `v2ex` account and one `guozaoke` account
  - click analyze
- Expected:
  - report succeeds
  - `stableTraits` section is visible when cluster data exists
  - `communitySpecificTraits` is grouped by community
  - `cluster confidence` and `account coverage` are visible
- Pass:
  - aggregated report fields are present and readable

### 4. Duplicate accounts behavior

- Mode: `MANUAL_CLUSTER`
- Input: the same `community + handle` twice
- Steps:
  - add a duplicate account row with whitespace/case variation
  - trigger analyze
- Expected:
  - the draft is deduped locally or submission is normalized
  - analyze request does not send the same unique account twice
  - report does not inflate coverage or metrics
- Pass:
  - duplicate input does not create duplicated analysis output

### 5. Suggestion fetch and display

- Mode: `MANUAL_CLUSTER`
- Input: at least two accounts across communities
- Steps:
  - click `获取关联建议`
- Expected:
  - loading state appears
  - `suggestions` show the candidate pair, confidence, reasons, and status
  - `ignoredPairs` or `warnings` show when returned
- Pass:
  - suggestion response is visible and understandable

### 6. Suggestion ACCEPT / REJECT stays local-only

- Mode: `MANUAL_CLUSTER`
- Input: any suggestion-bearing draft
- Steps:
  - click accept on one suggestion
  - click reject on another suggestion
  - then click analyze
- Expected:
  - suggestion status updates in the page
  - no backend merge happens
  - analyze request still uses only the current `accounts[]`
- Pass:
  - suggestion review changes local workflow state only

### 7. Partial-success aggregated scenario

- Mode: `MANUAL_CLUSTER`
- Input: one valid account and one intentionally failing or unavailable account
- Steps:
  - run aggregated analysis
- Expected:
  - report still renders if at least one account succeeds
  - warnings stay visible
  - account coverage clearly separates success and fail
  - cluster confidence is lower than a full-success case
- Pass:
  - partial success does not collapse into a 500 or a fake full success

### 8. Account coverage observation

- Mode: `MANUAL_CLUSTER`
- Input: any multi-account run
- Expected:
  - `requestedAccounts`, `successfulAccounts`, `failedAccounts`
  - `successfulCount`, `failedCount`
  - `activeCommunities`
  are all inspectable
- Pass:
  - an operator can tell what the analysis actually covered

### 9. stableTraits / communitySpecificTraits / overlap / divergence observation

- Mode: `MANUAL_CLUSTER`
- Input: cross-community cluster
- Expected:
  - `stableTraits` contains cross-community common traits
  - `communitySpecificTraits` is organized by community
  - `overlap / divergence` is either meaningfully present or absent without crashing
- Pass:
  - cluster-specific report sections are structurally usable

### 10. localStorage draft restore

- Mode: both
- Steps:
  - build a cluster draft
  - refresh the page
  - revisit `/analyze`
- Expected:
  - draft mode and account list are restored from localStorage
  - suggestion decisions persist if previously saved
  - if localStorage is unavailable, the page still works with in-memory state
- Pass:
  - local-only persistence works without server storage

### 11. Regression commands

- Run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Expected:
  - all three pass
- Pass:
  - Stage 4 has a releasable engineering baseline

## QA Record Template

- Case name:
- Mode:
- Input:
- Result: `Pass` / `Fail`
- Notes:
- Screenshot or log path:

## Exit Criteria

Stage 4 manual QA passes when:

1. single-account analysis remains compatible
2. manual cluster workflow can run end-to-end
3. suggestion remains suggestion-only
4. cluster report fields are observable when returned
5. localStorage draft persistence works
6. `npm run typecheck`, `npm test`, and `npm run build` all pass

