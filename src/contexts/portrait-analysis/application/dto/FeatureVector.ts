import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export type FeatureDistributionEntry = {
  name: string;
  count: number;
  share: number;
};

export type CommunityFeatureSlice = {
  community: CommunityId;
  handle: string;
  totalActivities: number;
  topicCount: number;
  replyCount: number;
  activeDays: number;
  avgTextLength: number;
  longFormRatio: number;
  questionRatio: number;
  linkRatio: number;
};

export type FeatureQualityFlag =
  | 'LOW_ACTIVITY_VOLUME'
  | 'LOW_ACTIVE_DAYS'
  | 'LOW_TEXT_DENSITY'
  | 'DEGRADED_SOURCE';

export type FeatureVector = {
  activity: {
    totalActivities: number;
    topicCount: number;
    replyCount: number;
    topicRatio: number;
    replyRatio: number;
    activeDays: number;
    activeSpanDays: number;
    avgActivitiesPerActiveDay: number;
    firstActivityAt?: string;
    lastActivityAt?: string;
    activeCommunities: CommunityId[];
    activeCommunityCount: number;
  };
  content: {
    avgTextLength: number;
    nonEmptyContentRatio: number;
    longFormRatio: number;
    questionRatio: number;
    linkRatio: number;
    substantiveTextRatio: number;
  };
  topic: {
    dominantTopics: FeatureDistributionEntry[];
    dominantNodes: FeatureDistributionEntry[];
    uniqueNodeCount: number;
    topicConcentration: number;
    diversityScore: number;
    nodeCoverageRatio: number;
  };
  community: {
    communityActivityShare: Partial<Record<CommunityId, number>>;
    perCommunityMetrics: Record<string, CommunityFeatureSlice>;
    crossCommunity: boolean;
  };
  dataQuality: {
    degraded: boolean;
    evidenceDensity: number;
    sufficientData: boolean;
    qualityFlags: FeatureQualityFlag[];
  };
};
