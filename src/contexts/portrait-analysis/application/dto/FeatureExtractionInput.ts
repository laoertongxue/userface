import type {
  CanonicalActivity,
  CommunityId,
  ConnectorWarning,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';

export type FeatureExtractionCommunityInput = {
  community: CommunityId;
  handle: string;
  degraded: boolean;
  warnings: ConnectorWarning[];
};

export type FeatureExtractionInput = {
  activities: CanonicalActivity[];
  communities: FeatureExtractionCommunityInput[];
};

export function buildFeatureExtractionInput(input: AnalyzePortraitInput): FeatureExtractionInput {
  return {
    activities: input.activityStream.activities,
    communities: input.snapshots.map((snapshot) => ({
      community: snapshot.ref.community,
      handle: snapshot.ref.handle,
      degraded: snapshot.diagnostics.degraded,
      warnings: snapshot.warnings,
    })),
  };
}
