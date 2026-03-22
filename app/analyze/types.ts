export type SupportedCommunity = 'v2ex' | 'guozaoke';

export type AnalyzeMode = 'SINGLE_ACCOUNT' | 'MANUAL_CLUSTER';

export type DraftAccount = {
  community: SupportedCommunity;
  handle: string;
};

export type SuggestionDecisionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type SuggestionDecision = {
  pairKey: string;
  status: SuggestionDecisionStatus;
};

export type ClusterDraft = {
  mode: AnalyzeMode;
  accounts: DraftAccount[];
  suggestionDecisions: SuggestionDecision[];
  lastSuggestedAt?: string;
  lastAnalyzedAt?: string;
};

export type ReportWarning = {
  code?: string;
  message?: string;
};

export type AnalyzeResponse = {
  communityBreakdowns?: Array<{
    community?: string;
    handle?: string;
    metrics?: Record<string, number>;
    summary?: string;
    tags?: string[];
  }>;
  evidence?: Array<{
    activityUrl?: string;
    community?: string;
    excerpt?: string;
    label?: string;
    publishedAt?: string;
  }>;
  metrics?: {
    activeDays?: number;
    avgTextLength?: number;
    replyCount?: number;
    topicCount?: number;
    totalActivities?: number;
  };
  portrait?: {
    archetype?: string;
    confidence?: number;
    summary?: string;
    tags?: string[];
  };
  narrative?: {
    generatedBy?: 'RULE_ONLY' | 'LLM_ASSISTED' | 'NONE';
    fallbackUsed?: boolean;
    mode?: 'OFF' | 'RULE_ONLY' | 'LLM_ASSISTED';
    tone?: 'NEUTRAL' | 'ANALYTICAL' | 'CONCISE';
    audience?: 'PRODUCT_USER' | 'INTERNAL_QA';
    headline?: string;
    shortSummary?: string;
    deepSummary?: string;
    stableTraitsSummary?: string;
    communitySpecificSummary?: string;
    overlapDivergenceSummary?: string;
    caveats?: string;
    sections?: Array<{
      code?: string;
      content?: string;
      grounded?: boolean;
      sourceHints?: string[];
      supportingEvidenceIds?: string[];
    }>;
    warnings?: string[];
  };
  warnings?: ReportWarning[];
  cluster?: {
    stableTraits?: Array<{
      code?: string;
      displayName?: string;
      confidence?: number;
      supportingSignals?: string[];
      sourceCommunities?: string[];
    }>;
    communitySpecificTraits?: Record<
      string,
      Array<{
        code?: string;
        displayName?: string;
        rationale?: string;
        strength?: number;
      }>
    >;
    overlap?: Array<{
      code?: string;
      communities?: string[];
      rationale?: string;
      dominantCommunity?: string;
      comparedCommunities?: string[];
    }>;
    divergence?: Array<{
      code?: string;
      communities?: string[];
      rationale?: string;
      dominantCommunity?: string;
      comparedCommunities?: string[];
    }>;
    confidence?: {
      overall?: number;
      reasons?: string[];
      flags?: string[];
    };
    accountCoverage?: {
      requestedAccounts?: Array<{
        community?: string;
        handle?: string;
        displayName?: string;
        homepageUrl?: string;
        uid?: string;
      }>;
      successfulAccounts?: Array<{
        community?: string;
        handle?: string;
        displayName?: string;
        homepageUrl?: string;
        uid?: string;
      }>;
      failedAccounts?: Array<{
        account?: {
          community?: string;
          handle?: string;
          displayName?: string;
          homepageUrl?: string;
          uid?: string;
        };
        reason?: string;
      }>;
      successfulCount?: number;
      failedCount?: number;
      activeCommunities?: string[];
      accountStatuses?: Array<{
        account?: {
          community?: string;
          handle?: string;
          displayName?: string;
          homepageUrl?: string;
          uid?: string;
        };
        status?: string;
        degraded?: boolean;
        warningCodes?: string[];
        reason?: string;
      }>;
    };
  };
};

export type AnalyzeError = {
  code: string;
  details?: unknown;
  message: string;
};

export type SuggestionResponse = {
  suggestions?: Array<{
    candidateAccounts?: Array<{
      community?: string;
      handle?: string;
      displayName?: string;
      homepageUrl?: string;
      uid?: string;
    }>;
    confidence?: number;
    reasons?: string[];
    status?: SuggestionDecisionStatus;
    sourceHint?: string;
  }>;
  inspectedAccounts?: Array<{
    community?: string;
    handle?: string;
  }>;
  ignoredPairs?: Array<{
    from?: {
      community?: string;
      handle?: string;
    };
    to?: {
      community?: string;
      handle?: string;
    };
    reason?: string;
  }>;
  warnings?: ReportWarning[];
};
