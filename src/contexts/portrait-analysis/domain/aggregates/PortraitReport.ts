export type PortraitEvidence = {
  label: string;
  excerpt: string;
  activityUrl: string;
  community: string;
  publishedAt: string;
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

export type PortraitReport = {
  portrait: Portrait;
  evidence: PortraitEvidence[];
  metrics: PortraitMetrics;
  communityBreakdowns: CommunityBreakdown[];
  warnings: PortraitWarning[];
};
