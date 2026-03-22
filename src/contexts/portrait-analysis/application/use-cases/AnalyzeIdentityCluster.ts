import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import type { PortraitReport } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import { analysisConfig } from '@/src/config/analysis';
import { countDistinctDays } from '@/src/shared/utils/date';
import { truncateText } from '@/src/shared/utils/text';

export class AnalyzeIdentityCluster {
  execute(input: AnalyzePortraitInput): PortraitReport {
    const activities = input.activityStream.activities;
    const topicCount = activities.filter((activity) => activity.type === 'topic').length;
    const replyCount = activities.filter((activity) => activity.type === 'reply').length;
    const totalLength = activities.reduce((sum, activity) => sum + activity.contentText.length, 0);
    const avgTextLength = activities.length > 0 ? Math.round(totalLength / activities.length) : 0;
    const activeDays = countDistinctDays(activities.map((activity) => activity.publishedAt));
    const activeCommunities = new Set(activities.map((activity) => activity.community)).size;
    const metrics = {
      totalActivities: activities.length,
      topicCount,
      replyCount,
      avgTextLength,
      activeDays,
    };

    const tags: string[] = [];

    if (activeCommunities > 1) {
      tags.push('cross-community');
    }

    if (replyCount > topicCount) {
      tags.push('discussion-heavy');
    } else if (topicCount > 0) {
      tags.push('topic-led');
    }

    if (activities.length >= 30) {
      tags.push('high-output');
    }

    if (avgTextLength >= 180) {
      tags.push('long-form');
    }

    const portrait =
      activities.length === 0
        ? {
            archetype: 'insufficient-data',
            tags: [],
            summary:
              'No analyzable activities are available yet. Connector scaffolds are in place, but live fetching is not implemented.',
            confidence: 0.15,
          }
        : {
            archetype: replyCount >= topicCount ? 'discussion-oriented' : 'topic-oriented',
            tags,
            summary: `Observed ${activities.length} activities across ${Math.max(
              activeCommunities,
              1,
            )} communities over ${Math.max(activeDays, 1)} active days. The current portrait is fully rule-based and ready to be augmented by connector-specific evidence later.`,
            confidence: Math.min(0.92, 0.35 + activities.length * 0.01),
          };

    return {
      portrait,
      evidence: activities.slice(0, analysisConfig.evidenceLimit).map((activity) => ({
        label: activity.type === 'topic' ? 'Representative topic' : 'Representative reply',
        excerpt: truncateText(activity.excerpt || activity.contentText, 180),
        activityUrl: activity.url,
        community: activity.community,
        publishedAt: activity.publishedAt,
      })),
      metrics,
      communityBreakdowns: input.snapshots.map((snapshot) => {
        const snapshotActivities = activities.filter(
          (activity) =>
            activity.community === snapshot.ref.community && activity.handle === snapshot.ref.handle,
        );
        const snapshotTopics = snapshotActivities.filter((activity) => activity.type === 'topic').length;
        const snapshotReplies = snapshotActivities.filter(
          (activity) => activity.type === 'reply',
        ).length;

        return {
          community: snapshot.ref.community,
          handle: snapshot.ref.handle,
          tags: snapshotActivities.length === 0 ? ['pending-connector'] : tags,
          summary:
            snapshotActivities.length === 0
              ? `${snapshot.ref.community} connector is scaffolded but has not produced analyzable activities yet.`
              : `Collected ${snapshotActivities.length} activities from ${snapshot.ref.community}.`,
          metrics: {
            totalActivities: snapshotActivities.length,
            topicCount: snapshotTopics,
            replyCount: snapshotReplies,
          },
        };
      }),
      warnings: input.snapshots.flatMap((snapshot) => snapshot.warnings),
    };
  }
}
