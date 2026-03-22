import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';

export type Signal = {
  code: SignalCode;
  score: number;
  rationale: string;
  supportingEvidenceIds: string[];
  communityScope: 'global' | CommunityId;
};
