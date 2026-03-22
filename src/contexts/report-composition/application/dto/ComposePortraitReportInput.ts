import type { IdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { CommunitySynthesisResult } from '@/src/contexts/portrait-analysis/application/dto/CommunitySynthesisResult';
import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type { ClusterMergeResult } from '@/src/contexts/portrait-analysis/application/dto/ClusterMergeResult';
import type { RuleEvaluationResult } from '@/src/contexts/portrait-analysis/application/dto/RuleEvaluationResult';
import type { PortraitWarning } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import type { FetchIdentityClusterSnapshotsResult } from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';

export type ComposePortraitReportInput = {
  archetype: ArchetypeCode;
  confidenceProfile: ConfidenceProfile;
  evidenceCandidates: EvidenceCandidate[];
  featureVector: FeatureVector;
  identityCluster: IdentityCluster;
  primaryArchetype: RuleEvaluationResult['primaryArchetype'];
  selectedEvidence: EvidenceCandidate[];
  signals: Signal[];
  synthesisResult: CommunitySynthesisResult;
  tags: PortraitTag[];
  warnings: PortraitWarning[];
  clusterMergeResult?: ClusterMergeResult;
  fetchResult?: FetchIdentityClusterSnapshotsResult;
};
