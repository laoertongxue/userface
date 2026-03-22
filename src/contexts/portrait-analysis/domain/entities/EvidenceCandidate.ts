import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export type EvidenceCandidate = {
  id: string;
  activityId: string;
  community: CommunityId;
  activityType?: 'topic' | 'reply';
  labelHint: string;
  excerpt: string;
  activityUrl: string;
  publishedAt: string;
  reasons: string[];
  nodeName?: string;
  score?: number;
  textLength?: number;
};
