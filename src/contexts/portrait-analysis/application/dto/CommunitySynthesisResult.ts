import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { TagCode } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';

export type CommunityInsight = {
  community: CommunityId;
  handle: string;
  dominantTraits: TagCode[];
  summaryHint: string;
  confidenceModifier?: number;
};

export type CommunitySynthesisResult = {
  stableTraits: TagCode[];
  communityInsights: CommunityInsight[];
};
