import type { CanonicalActivity, ConnectorWarning } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';

export type EvidenceSelectionInput = {
  activities: CanonicalActivity[];
  featureVector: FeatureVector;
  warnings?: ConnectorWarning[];
  maxEvidence?: number;
};
