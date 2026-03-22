import type { CommunityId } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type {
  FeatureDistributionEntry,
  FeatureQualityFlag,
  FeatureVector,
} from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type {
  FeatureExtractionCommunityInput,
  FeatureExtractionInput,
} from '@/src/contexts/portrait-analysis/application/dto/FeatureExtractionInput';
import {
  FEATURE_EXTRACTION_POLICY,
  LONG_FORM_THRESHOLD_CHARS,
  SUBSTANTIVE_TEXT_THRESHOLD_CHARS,
  SUFFICIENT_DATA_MIN_ACTIVE_DAYS,
  SUFFICIENT_DATA_MIN_ACTIVITIES,
  SUFFICIENT_DATA_MIN_EVIDENCE_DENSITY,
} from '@/src/contexts/portrait-analysis/domain/services/FeatureExtractionPolicy';
import { dayDiff } from '@/src/shared/utils/date';
import { normalizeWhitespace } from '@/src/shared/utils/text';

type PreparedActivity = {
  community: CommunityId;
  handle: string;
  isLink: boolean;
  isLongForm: boolean;
  isQuestion: boolean;
  isReply: boolean;
  isSubstantive: boolean;
  isTopic: boolean;
  nodeName?: string;
  publishedAt: string;
  text: string;
  textLength: number;
  topicTitle?: string;
};

function roundRatio(value: number): number {
  return Number(value.toFixed(4));
}

function safeIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function resolvePublishedAt(publishedAt: string, fetchedAt: string): string | undefined {
  return safeIsoDate(publishedAt) ?? safeIsoDate(fetchedAt);
}

function dateKey(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

function countDistinctDays(values: string[]): number {
  return new Set(values.map((value) => dateKey(value))).size;
}

function normalizeActivityText(rawText: string | undefined): string {
  return normalizeWhitespace(rawText ?? '');
}

function hasQuestion(text: string): boolean {
  return text.includes('?') || text.includes('？');
}

function hasLink(text: string): boolean {
  return /(https?:\/\/|www\.)/i.test(text);
}

function toDistributionEntries(
  counts: Map<string, number>,
  total: number,
  limit = FEATURE_EXTRACTION_POLICY.dominantNodeLimit,
): FeatureDistributionEntry[] {
  if (total === 0) {
    return [];
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([name, count]) => ({
      name,
      count,
      share: roundRatio(count / total),
    }));
}

function prepareActivities(input: FeatureExtractionInput): PreparedActivity[] {
  return input.activities.flatMap((activity) => {
    const publishedAt = resolvePublishedAt(activity.publishedAt, activity.sourceTrace.fetchedAt);

    if (!publishedAt) {
      return [];
    }

    const text = normalizeActivityText(activity.contentText || activity.excerpt);
    const textLength = text.length;

    return [
      {
        community: activity.community,
        handle: activity.handle,
        isLink: hasLink(text),
        isLongForm: textLength >= LONG_FORM_THRESHOLD_CHARS,
        isQuestion: hasQuestion(text),
        isReply: activity.type === 'reply',
        isSubstantive: textLength >= SUBSTANTIVE_TEXT_THRESHOLD_CHARS,
        isTopic: activity.type === 'topic',
        nodeName: activity.nodeName || undefined,
        publishedAt,
        text,
        textLength,
        topicTitle: activity.topicTitle || undefined,
      },
    ];
  });
}

function buildCommunityMetricKey(input: FeatureExtractionCommunityInput): string {
  return `${input.community}:${input.handle}`;
}

export class FeatureExtractionService {
  extract(input: FeatureExtractionInput): FeatureVector {
    const preparedActivities = prepareActivities(input);
    const totalActivities = preparedActivities.length;
    const topicCount = preparedActivities.filter((activity) => activity.isTopic).length;
    const replyCount = preparedActivities.filter((activity) => activity.isReply).length;
    const nonEmptyCount = preparedActivities.filter((activity) => activity.textLength > 0).length;
    const longFormCount = preparedActivities.filter((activity) => activity.isLongForm).length;
    const questionCount = preparedActivities.filter((activity) => activity.isQuestion).length;
    const linkCount = preparedActivities.filter((activity) => activity.isLink).length;
    const substantiveCount = preparedActivities.filter((activity) => activity.isSubstantive).length;
    const totalTextLength = preparedActivities.reduce((sum, activity) => sum + activity.textLength, 0);
    const sortedTimestamps = preparedActivities
      .map((activity) => activity.publishedAt)
      .sort((left, right) => left.localeCompare(right));
    const firstActivityAt = sortedTimestamps[0];
    const lastActivityAt = sortedTimestamps[sortedTimestamps.length - 1];
    const activeDays = countDistinctDays(sortedTimestamps);
    const activeSpanDays =
      firstActivityAt && lastActivityAt ? Math.max(dayDiff(firstActivityAt, lastActivityAt) + 1, 1) : 0;
    const activeCommunities = [...new Set(preparedActivities.map((activity) => activity.community))].sort();
    const nodeNamedActivities = preparedActivities.filter((activity) => Boolean(activity.nodeName));
    const nodeCounts = nodeNamedActivities.reduce<Map<string, number>>((accumulator, activity) => {
      if (!activity.nodeName) {
        return accumulator;
      }

      accumulator.set(activity.nodeName, (accumulator.get(activity.nodeName) ?? 0) + 1);
      return accumulator;
    }, new Map());
    const topicCounts = preparedActivities.reduce<Map<string, number>>((accumulator, activity) => {
      if (!activity.topicTitle) {
        return accumulator;
      }

      accumulator.set(activity.topicTitle, (accumulator.get(activity.topicTitle) ?? 0) + 1);
      return accumulator;
    }, new Map());
    const dominantNodes = toDistributionEntries(nodeCounts, nodeNamedActivities.length);
    const dominantTopics = toDistributionEntries(topicCounts, totalActivities);
    const uniqueNodeCount = nodeCounts.size;
    const topicConcentration = dominantNodes[0]?.share ?? 0;
    const diversityScore =
      nodeNamedActivities.length === 0
        ? 0
        : roundRatio(uniqueNodeCount / nodeNamedActivities.length);
    const nodeCoverageRatio =
      totalActivities === 0 ? 0 : roundRatio(nodeNamedActivities.length / totalActivities);
    const communityActivityShare = activeCommunities.reduce<
      FeatureVector['community']['communityActivityShare']
    >((accumulator, community) => {
      const communityCount = preparedActivities.filter((activity) => activity.community === community).length;
      accumulator[community] = totalActivities === 0 ? 0 : roundRatio(communityCount / totalActivities);
      return accumulator;
    }, {});
    const perCommunityMetrics = input.communities.reduce<FeatureVector['community']['perCommunityMetrics']>(
      (accumulator, communityInput) => {
        const communityActivities = preparedActivities.filter(
          (activity) =>
            activity.community === communityInput.community && activity.handle === communityInput.handle,
        );
        const communityKey = buildCommunityMetricKey(communityInput);
        const communityActiveDays = countDistinctDays(
          communityActivities.map((activity) => activity.publishedAt),
        );
        const communityTotalTextLength = communityActivities.reduce(
          (sum, activity) => sum + activity.textLength,
          0,
        );

        accumulator[communityKey] = {
          community: communityInput.community,
          handle: communityInput.handle,
          totalActivities: communityActivities.length,
          topicCount: communityActivities.filter((activity) => activity.isTopic).length,
          replyCount: communityActivities.filter((activity) => activity.isReply).length,
          activeDays: communityActiveDays,
          avgTextLength:
            communityActivities.length === 0
              ? 0
              : Math.round(communityTotalTextLength / communityActivities.length),
          longFormRatio:
            communityActivities.length === 0
              ? 0
              : roundRatio(
                  communityActivities.filter((activity) => activity.isLongForm).length /
                    communityActivities.length,
                ),
          questionRatio:
            communityActivities.length === 0
              ? 0
              : roundRatio(
                  communityActivities.filter((activity) => activity.isQuestion).length /
                    communityActivities.length,
                ),
          linkRatio:
            communityActivities.length === 0
              ? 0
              : roundRatio(
                  communityActivities.filter((activity) => activity.isLink).length /
                    communityActivities.length,
                ),
        };

        return accumulator;
      },
      {},
    );
    const degraded =
      input.communities.some((community) => community.degraded) ||
      input.communities.some((community) => community.warnings.length > 0);
    const evidenceDensity =
      totalActivities === 0 ? 0 : roundRatio(substantiveCount / totalActivities);
    const qualityFlags: FeatureQualityFlag[] = [];

    if (totalActivities < SUFFICIENT_DATA_MIN_ACTIVITIES) {
      qualityFlags.push('LOW_ACTIVITY_VOLUME');
    }

    if (activeDays < SUFFICIENT_DATA_MIN_ACTIVE_DAYS) {
      qualityFlags.push('LOW_ACTIVE_DAYS');
    }

    if (evidenceDensity < SUFFICIENT_DATA_MIN_EVIDENCE_DENSITY) {
      qualityFlags.push('LOW_TEXT_DENSITY');
    }

    if (degraded) {
      qualityFlags.push('DEGRADED_SOURCE');
    }

    return {
      activity: {
        totalActivities,
        topicCount,
        replyCount,
        topicRatio: totalActivities === 0 ? 0 : roundRatio(topicCount / totalActivities),
        replyRatio: totalActivities === 0 ? 0 : roundRatio(replyCount / totalActivities),
        activeDays,
        activeSpanDays,
        avgActivitiesPerActiveDay:
          activeDays === 0 ? 0 : roundRatio(totalActivities / activeDays),
        firstActivityAt,
        lastActivityAt,
        activeCommunities,
        activeCommunityCount: activeCommunities.length,
      },
      content: {
        avgTextLength: totalActivities === 0 ? 0 : Math.round(totalTextLength / totalActivities),
        nonEmptyContentRatio:
          totalActivities === 0 ? 0 : roundRatio(nonEmptyCount / totalActivities),
        longFormRatio:
          totalActivities === 0 ? 0 : roundRatio(longFormCount / totalActivities),
        questionRatio:
          totalActivities === 0 ? 0 : roundRatio(questionCount / totalActivities),
        linkRatio: totalActivities === 0 ? 0 : roundRatio(linkCount / totalActivities),
        substantiveTextRatio:
          totalActivities === 0 ? 0 : roundRatio(substantiveCount / totalActivities),
      },
      topic: {
        dominantTopics,
        dominantNodes,
        uniqueNodeCount,
        topicConcentration,
        diversityScore,
        nodeCoverageRatio,
      },
      community: {
        communityActivityShare,
        perCommunityMetrics,
        crossCommunity: activeCommunities.length >= 2,
      },
      dataQuality: {
        degraded,
        evidenceDensity,
        sufficientData:
          totalActivities >= SUFFICIENT_DATA_MIN_ACTIVITIES &&
          activeDays >= SUFFICIENT_DATA_MIN_ACTIVE_DAYS &&
          evidenceDensity >= SUFFICIENT_DATA_MIN_EVIDENCE_DENSITY,
        qualityFlags,
      },
    };
  }
}
