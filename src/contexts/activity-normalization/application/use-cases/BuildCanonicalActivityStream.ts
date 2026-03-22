import type {
  CanonicalActivity,
  ConnectorSnapshot,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { uniqueBy } from '@/src/shared/utils/collection';

export type ActivityStream = {
  activities: CanonicalActivity[];
};

export class BuildCanonicalActivityStream {
  execute(snapshots: ConnectorSnapshot[]): ActivityStream {
    const activities = snapshots.flatMap((snapshot) => snapshot.activities);

    return {
      activities: uniqueBy(
        activities,
        (activity) =>
          `${activity.community}:${activity.url}:${activity.sourceTrace.contentHash}:${activity.publishedAt}`,
      ).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)),
    };
  }
}
