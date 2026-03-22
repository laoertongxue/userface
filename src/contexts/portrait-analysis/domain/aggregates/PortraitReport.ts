import type { NarrativeGeneratedBy } from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import type { NarrativeAudience } from '@/src/contexts/report-composition/domain/value-objects/NarrativeAudience';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import type { NarrativeTone } from '@/src/contexts/report-composition/domain/value-objects/NarrativeTone';

export type PortraitEvidence = {
  label: string;
  excerpt: string;
  activityUrl: string;
  community: string;
  publishedAt: string;
};

export type ReportAccountRef = {
  community: string;
  handle: string;
  uid?: string;
  homepageUrl?: string;
  displayName?: string;
};

export type PortraitMetrics = {
  totalActivities: number;
  topicCount: number;
  replyCount: number;
  avgTextLength: number;
  activeDays: number;
};

export type CommunityBreakdown = {
  community: string;
  handle: string;
  tags: string[];
  summary: string;
  metrics: Record<string, number>;
};

export type Portrait = {
  archetype: string;
  tags: string[];
  summary: string;
  confidence: number;
};

export type PortraitWarning = {
  code: string;
  message: string;
};

export type AggregatedTrait = {
  code: string;
  displayName: string;
  confidence: number;
  supportingSignals: string[];
  sourceCommunities: string[];
};

export type CommunitySpecificTrait = {
  code: string;
  displayName: string;
  rationale: string;
  strength?: number;
};

export type OverlapInsight = {
  code: string;
  communities: string[];
  rationale: string;
  dominantCommunity?: string;
  comparedCommunities?: string[];
};

export type AccountCoverageFailure = {
  account: ReportAccountRef;
  reason?: string;
};

export type AccountCoverageEntry = {
  account: ReportAccountRef;
  status: 'REQUESTED' | 'SUCCESS' | 'FAILED';
  degraded: boolean;
  warningCodes: string[];
  reason?: string;
};

export type AccountCoverage = {
  requestedAccounts: ReportAccountRef[];
  successfulAccounts: ReportAccountRef[];
  failedAccounts: AccountCoverageFailure[];
  successfulCount: number;
  failedCount: number;
  activeCommunities: string[];
  accountStatuses?: AccountCoverageEntry[];
};

export type ClusterConfidenceSummary = {
  overall: number;
  reasons: string[];
  flags: string[];
};

export type ClusterInsights = {
  stableTraits: AggregatedTrait[];
  communitySpecificTraits: Record<string, CommunitySpecificTrait[]>;
  overlap?: OverlapInsight[];
  divergence?: OverlapInsight[];
  confidence?: ClusterConfidenceSummary;
  accountCoverage: AccountCoverage;
};

export type PortraitNarrative = {
  generatedBy: NarrativeGeneratedBy;
  fallbackUsed: boolean;
  mode: NarrativeMode;
  tone: NarrativeTone;
  audience: NarrativeAudience;
  headline?: string;
  shortSummary?: string;
  deepSummary?: string;
  stableTraitsSummary?: string;
  communitySpecificSummary?: string;
  overlapDivergenceSummary?: string;
  caveats?: string;
  sections?: NarrativeSection[];
  warnings?: string[];
};

export type PortraitReport = {
  portrait: Portrait;
  evidence: PortraitEvidence[];
  metrics: PortraitMetrics;
  communityBreakdowns: CommunityBreakdown[];
  warnings: PortraitWarning[];
  cluster?: ClusterInsights;
  narrative?: PortraitNarrative;
};
