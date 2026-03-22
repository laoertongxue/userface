import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';

export type EvidenceSelectionStats = {
  totalCandidates: number;
  selectedCount: number;
  topicEvidenceCount: number;
  replyEvidenceCount: number;
  communityCoverage: CommunityId[];
  dedupedCount: number;
};

export type EvidenceSelectionResult = {
  candidates: EvidenceCandidate[];
  selected: EvidenceCandidate[];
  stats: EvidenceSelectionStats;
};
