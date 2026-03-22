import type {
  CanonicalActivity,
  CommunityProfileSnapshot,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import {
  resolveGuozaokeUrl,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/config';
import type {
  ParsedGuozaokeReplyItem,
  ParsedGuozaokeTopicItem,
  ParsedGuozaokeUserProfile,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/parsers';
import type { HashService } from '@/src/shared/contracts/HashService';
import { NodeHashService } from '@/src/shared/contracts/HashService';
import { truncateText } from '@/src/shared/utils/text';

type ActivitySourceContext = {
  fetchedAt: string;
  handle: string;
  route: string;
};

function normalizeExternalUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  const trimmed = url.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return resolveGuozaokeUrl(trimmed);
  }

  return `https://${trimmed}`;
}

function parseRegisteredAt(registeredAtText?: string): string | undefined {
  if (!registeredAtText) {
    return undefined;
  }

  const normalized = registeredAtText.trim();
  const fullDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return new Date(`${year}-${month}-${day}T00:00:00+08:00`).toISOString();
  }

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  return undefined;
}

function parsePublishedAt(rawText: string | undefined, fetchedAt: string): string {
  const fetchedDate = new Date(fetchedAt);
  const fetchedTime = fetchedDate.getTime();

  if (Number.isNaN(fetchedTime)) {
    return new Date().toISOString();
  }

  if (!rawText) {
    return fetchedDate.toISOString();
  }

  const normalized = rawText.trim();

  if (!normalized || normalized === '今天' || normalized === '刚刚') {
    return fetchedDate.toISOString();
  }

  if (normalized === '昨天') {
    return new Date(fetchedTime - 24 * 60 * 60_000).toISOString();
  }

  const secondsMatch = normalized.match(/^(\d+)\s*秒前$/);
  if (secondsMatch) {
    return new Date(fetchedTime - Number(secondsMatch[1]) * 1000).toISOString();
  }

  const minutesMatch = normalized.match(/^(\d+)\s*分钟前$/);
  if (minutesMatch) {
    return new Date(fetchedTime - Number(minutesMatch[1]) * 60_000).toISOString();
  }

  const hoursMatch = normalized.match(/^(\d+)\s*小时前$/);
  if (hoursMatch) {
    return new Date(fetchedTime - Number(hoursMatch[1]) * 60 * 60_000).toISOString();
  }

  const daysMatch = normalized.match(/^(\d+)\s*天前$/);
  if (daysMatch) {
    return new Date(fetchedTime - Number(daysMatch[1]) * 24 * 60 * 60_000).toISOString();
  }

  const weeksMatch = normalized.match(/^(\d+)\s*周前$/);
  if (weeksMatch) {
    return new Date(fetchedTime - Number(weeksMatch[1]) * 7 * 24 * 60 * 60_000).toISOString();
  }

  const monthsMatch = normalized.match(/^(\d+)\s*月前$/);
  if (monthsMatch) {
    return new Date(fetchedTime - Number(monthsMatch[1]) * 30 * 24 * 60 * 60_000).toISOString();
  }

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  return fetchedDate.toISOString();
}

function extractTopicId(url: string): string | undefined {
  const match = url.match(/\/t\/(\d+)/);
  return match?.[1];
}

function buildActivityId(
  hashService: HashService,
  type: CanonicalActivity['type'],
  handle: string,
  url: string,
  publishedAt: string,
  contentText: string,
): string {
  return hashService.sha256(
    JSON.stringify({
      contentText,
      handle,
      publishedAt,
      type,
      url,
    }),
  );
}

function buildContentHash(hashService: HashService, contentText: string, topicTitle: string): string {
  return hashService.sha256(`${topicTitle}\n${contentText}`);
}

export function mapUserProfile(
  parsedProfile: Extract<ParsedGuozaokeUserProfile, { status: 'found' }>,
): CommunityProfileSnapshot {
  return {
    community: 'guozaoke',
    handle: parsedProfile.handle,
    displayName: parsedProfile.displayName || parsedProfile.handle,
    avatarUrl: normalizeExternalUrl(parsedProfile.avatarUrl),
    bio: parsedProfile.bio,
    homepageUrl: normalizeExternalUrl(parsedProfile.homepageUrl),
    registeredAt: parseRegisteredAt(parsedProfile.registeredAtText),
    stats: {
      favorites: parsedProfile.stats.favorites,
      replies: parsedProfile.stats.replies,
      topics: parsedProfile.stats.topics,
    },
  };
}

export function mapReplyActivity(
  item: ParsedGuozaokeReplyItem,
  source: ActivitySourceContext,
  hashService: HashService = new NodeHashService(),
): CanonicalActivity {
  const absoluteUrl = resolveGuozaokeUrl(item.topicUrl);
  const publishedAt = parsePublishedAt(item.publishedAtText, source.fetchedAt);
  const excerpt = truncateText(item.excerpt || item.contentText, 180);

  return {
    id: buildActivityId(
      hashService,
      'reply',
      source.handle,
      absoluteUrl,
      publishedAt,
      item.contentText,
    ),
    community: 'guozaoke',
    handle: source.handle,
    type: 'reply',
    url: absoluteUrl,
    topicId: extractTopicId(absoluteUrl),
    topicTitle: item.topicTitle,
    nodeName: item.nodeName,
    contentText: item.contentText,
    excerpt,
    publishedAt,
    sourceTrace: {
      route: source.route,
      fetchedAt: source.fetchedAt,
      contentHash: buildContentHash(hashService, item.contentText, item.topicTitle),
    },
  };
}

export function mapTopicActivity(
  item: ParsedGuozaokeTopicItem,
  source: ActivitySourceContext,
  hashService: HashService = new NodeHashService(),
): CanonicalActivity {
  const absoluteUrl = resolveGuozaokeUrl(item.topicUrl);
  const publishedAt = parsePublishedAt(item.publishedAtText, source.fetchedAt);
  const excerpt = truncateText(item.excerpt || item.topicTitle, 180);

  return {
    id: buildActivityId(
      hashService,
      'topic',
      source.handle,
      absoluteUrl,
      publishedAt,
      item.contentText,
    ),
    community: 'guozaoke',
    handle: source.handle,
    type: 'topic',
    url: absoluteUrl,
    topicId: extractTopicId(absoluteUrl),
    topicTitle: item.topicTitle,
    nodeName: item.nodeName,
    contentText: item.contentText,
    excerpt,
    publishedAt,
    stats: {
      replyCount: item.replyCount,
    },
    sourceTrace: {
      route: source.route,
      fetchedAt: source.fetchedAt,
      contentHash: buildContentHash(hashService, item.contentText, item.topicTitle),
    },
  };
}
