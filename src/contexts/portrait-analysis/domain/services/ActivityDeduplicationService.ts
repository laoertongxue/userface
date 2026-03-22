import type { CanonicalActivity } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { ACTIVITY_DEDUPLICATION_POLICY } from '@/src/contexts/portrait-analysis/domain/services/ActivityDeduplicationPolicy';
import { normalizeWhitespace } from '@/src/shared/utils/text';

export type ActivityDeduplicationResult = {
  dedupedActivities: CanonicalActivity[];
  removedCount: number;
  dedupeReasons: Array<{
    keptId: string;
    removedId: string;
    reason: 'ACTIVITY_ID' | 'COMMUNITY_URL_TYPE' | 'COMMUNITY_EXCERPT_PUBLISHED_TYPE';
  }>;
};

type MatchReason = ActivityDeduplicationResult['dedupeReasons'][number]['reason'];

function normalizeExcerpt(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function byPublishedAtDescending(left: CanonicalActivity, right: CanonicalActivity): number {
  const timeCompare = right.publishedAt.localeCompare(left.publishedAt);

  if (timeCompare !== 0) {
    return timeCompare;
  }

  return `${left.community}:${left.handle}:${left.id}:${left.url}`.localeCompare(
    `${right.community}:${right.handle}:${right.id}:${right.url}`,
  );
}

function completenessScore(activity: CanonicalActivity): number {
  return [
    activity.contentText.length,
    activity.excerpt.length,
    activity.topicTitle ? 50 : 0,
    activity.nodeName ? 25 : 0,
    activity.url ? 25 : 0,
    activity.publishedAt ? 25 : 0,
    activity.stats ? Object.keys(activity.stats).length * 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function detectDuplicateReason(
  left: CanonicalActivity,
  right: CanonicalActivity,
): MatchReason | null {
  if (left.id && right.id && left.id === right.id) {
    return 'ACTIVITY_ID';
  }

  if (
    left.community === right.community &&
    left.type === right.type &&
    left.url &&
    right.url &&
    left.url === right.url
  ) {
    return 'COMMUNITY_URL_TYPE';
  }

  if (
    left.community === right.community &&
    left.type === right.type &&
    left.publishedAt === right.publishedAt &&
    normalizeExcerpt(left.excerpt) === normalizeExcerpt(right.excerpt)
  ) {
    return 'COMMUNITY_EXCERPT_PUBLISHED_TYPE';
  }

  return null;
}

export class ActivityDeduplicationService {
  dedupe(activities: CanonicalActivity[]): ActivityDeduplicationResult {
    const kept: CanonicalActivity[] = [];
    const dedupeReasons: ActivityDeduplicationResult['dedupeReasons'] = [];

    activities.forEach((activity) => {
      const duplicateIndex = kept.findIndex((candidate) => detectDuplicateReason(candidate, activity));

      if (duplicateIndex === -1) {
        kept.push(activity);
        return;
      }

      const existing = kept[duplicateIndex];
      const reason = detectDuplicateReason(existing, activity);

      if (!reason) {
        kept.push(activity);
        return;
      }

      const keepIncoming =
        ACTIVITY_DEDUPLICATION_POLICY.preferRicherActivityWhenDuplicate &&
        completenessScore(activity) > completenessScore(existing);

      if (keepIncoming) {
        kept[duplicateIndex] = activity;
        dedupeReasons.push({
          keptId: activity.id,
          removedId: existing.id,
          reason,
        });
        return;
      }

      dedupeReasons.push({
        keptId: existing.id,
        removedId: activity.id,
        reason,
      });
    });

    const dedupedActivities = ACTIVITY_DEDUPLICATION_POLICY.sortDescendingByPublishedAt
      ? [...kept].sort(byPublishedAtDescending)
      : kept;

    return {
      dedupedActivities,
      removedCount: activities.length - dedupedActivities.length,
      dedupeReasons,
    };
  }
}
