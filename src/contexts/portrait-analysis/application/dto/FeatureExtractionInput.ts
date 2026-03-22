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
  const communities = input.clusterMergeResult
    ? input.clusterMergeResult.perAccountWarnings.map((entry) => ({
        community: entry.account.community,
        handle: entry.account.handle,
        degraded: entry.degraded,
        warnings: entry.warnings,
      }))
    : input.snapshots.map((snapshot) => ({
        community: snapshot.ref.community,
        handle: snapshot.ref.handle,
        degraded: snapshot.diagnostics.degraded,
        warnings: snapshot.warnings,
      }));

  return {
    activities: input.activityStream?.activities ?? [],
    communities,
  };
}
