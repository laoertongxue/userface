export const governanceGoldenCases = {
  baselineHealthy: {
    name: 'baseline-healthy',
    purpose: 'Keep the normal single-account analyze path healthy and unblocked.',
    expected: {
      allow: true,
      degraded: false,
      errorCode: null,
      healthOverall: 'HEALTHY',
      releaseReady: true,
    },
  },
  analyzeRateLimited: {
    name: 'analyze-rate-limited',
    purpose: 'Reject repeated analyze requests from the same requester inside one window.',
    expected: {
      allow: false,
      errorCode: 'GOVERNANCE_RATE_LIMITED',
      hasRetryAfterSeconds: true,
      observabilityEvent: 'governance.rate_limit.hit',
    },
  },
  suggestPairExplosion: {
    name: 'suggest-pair-explosion',
    purpose: 'Reject suggest requests whose account pairs exceed the request budget.',
    expected: {
      allow: false,
      errorCode: 'GOVERNANCE_TOO_MANY_SUGGESTION_PAIRS',
      abuseSignal: 'TOO_MANY_SUGGESTION_PAIRS',
    },
  },
  narrativeBudgetDisabled: {
    name: 'narrative-budget-disabled',
    purpose: 'Allow analyze to continue while disabling narrative when only the narrative budget is exceeded.',
    expected: {
      allow: true,
      degraded: true,
      disableNarrative: true,
      abuseSignal: 'NARRATIVE_BUDGET_EXCEEDED',
    },
  },
  connectorDegraded: {
    name: 'connector-degraded',
    purpose: 'Keep partial connector degradation visible without marking the whole runtime as fully unhealthy.',
    expected: {
      connectorStatus: 'DEGRADED',
      healthOverall: 'DEGRADED',
      releaseWarning: 'connectors-degraded',
    },
  },
  providerFallbackSafe: {
    name: 'provider-fallback-safe',
    purpose: 'Treat MiniMax failure as degraded when RuleOnly remains available.',
    expected: {
      providerStatus: 'DEGRADED',
      releaseReady: true,
      releaseWarning: 'narrative-provider-degraded',
    },
  },
  incidentModeClusterOff: {
    name: 'incident-mode-cluster-off',
    purpose: 'Incident mode should disable suggest and cluster while preserving safe single-account analyze.',
    expected: {
      clusterAllowed: false,
      singleAnalyzeAllowed: true,
      suggestAllowed: false,
      reasonCodes: [
        'RELEASE_INCIDENT_CLUSTER_DISABLED',
        'RELEASE_INCIDENT_SUGGEST_DISABLED',
      ],
    },
  },
  releaseNotReady: {
    name: 'release-not-ready',
    purpose: 'Mark runtime as not ready when core blockers such as incident or runtime failure are present.',
    expected: {
      ready: false,
      hasBlockers: true,
      blockerExamples: ['incident-active', 'runtime-unhealthy', 'analyze-disabled'],
    },
  },
} as const;

export type GovernanceGoldenCaseName = keyof typeof governanceGoldenCases;
