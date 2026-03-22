import type {
  CanonicalActivity,
  CommunityProfileSnapshot,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { HashService } from '@/src/shared/contracts/HashService';
import { NodeHashService } from '@/src/shared/contracts/HashService';
import { truncateText } from '@/src/shared/utils/text';
import { resolveV2exUrl } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/config';
import type {
  ParsedV2exMemberProfile,
  ParsedV2exReplyItem,
  ParsedV2exTopicItem,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';

type ActivitySourceContext = {
  fetchedAt: string;
  handle: string;
  route: string;
};

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function toShanghaiDateParts(value: Date): {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
} {
  const shifted = new Date(value.getTime() + SHANGHAI_OFFSET_MS);

  return {
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    month: shifted.getUTCMonth() + 1,
    second: shifted.getUTCSeconds(),
    year: shifted.getUTCFullYear(),
  };
}

function toShanghaiIsoString(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): string {
  const date = new Date(
    `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute
      .toString()
      .padStart(2, '0')}:${second.toString().padStart(2, '0')}+08:00`,
  );

  return date.toISOString();
}

function parsePublishedAt(rawText: string, fetchedAt: string, titleText?: string): string {
  if (titleText) {
    const titledDate = new Date(titleText);

    if (!Number.isNaN(titledDate.getTime())) {
      return titledDate.toISOString();
    }
  }

  const fetchedDate = new Date(fetchedAt);
  const fetchedTime = fetchedDate.getTime();

  if (Number.isNaN(fetchedTime)) {
    return new Date().toISOString();
  }

  const normalized = rawText.trim();

  if (!normalized) {
    return fetchedDate.toISOString();
  }

  if (/^刚刚$/.test(normalized)) {
    return fetchedDate.toISOString();
  }

  const secondsMatch = normalized.match(/^(\d+)\s*秒前$/);
  if (secondsMatch) {
    return new Date(fetchedTime - Number(secondsMatch[1]) * 1000).toISOString();
  }

  const minutesMatch = normalized.match(/^(\d+)\s*分钟前$/);
  if (minutesMatch) {
    return new Date(fetchedTime - Number(minutesMatch[1]) * 60_000).toISOString();
  }

  const hoursMatch = normalized.match(/^(\d+)\s*小时(?:\s*(\d+)\s*分钟)?前$/);
  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    const minutes = hoursMatch[2] ? Number(hoursMatch[2]) : 0;
    return new Date(fetchedTime - hours * 60 * 60_000 - minutes * 60_000).toISOString();
  }

  const daysMatch = normalized.match(/^(\d+)\s*天前$/);
  if (daysMatch) {
    return new Date(fetchedTime - Number(daysMatch[1]) * 24 * 60 * 60_000).toISOString();
  }

  const todayMatch = normalized.match(/^今天(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (todayMatch) {
    const shanghai = toShanghaiDateParts(fetchedDate);
    const hour = todayMatch[1] ? Number(todayMatch[1]) : shanghai.hour;
    const minute = todayMatch[2] ? Number(todayMatch[2]) : shanghai.minute;
    return toShanghaiIsoString(shanghai.year, shanghai.month, shanghai.day, hour, minute);
  }

  const yesterdayMatch = normalized.match(/^昨天(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (yesterdayMatch) {
    const yesterdayDate = new Date(fetchedTime - 24 * 60 * 60_000);
    const shanghai = toShanghaiDateParts(yesterdayDate);
    const hour = yesterdayMatch[1] ? Number(yesterdayMatch[1]) : shanghai.hour;
    const minute = yesterdayMatch[2] ? Number(yesterdayMatch[2]) : shanghai.minute;
    return toShanghaiIsoString(shanghai.year, shanghai.month, shanghai.day, hour, minute);
  }

  const monthDayMatch = normalized.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (monthDayMatch) {
    const shanghai = toShanghaiDateParts(fetchedDate);
    let year = shanghai.year;
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    let iso = toShanghaiIsoString(year, month, day);

    if (new Date(iso).getTime() > fetchedTime + 24 * 60 * 60_000) {
      year -= 1;
      iso = toShanghaiIsoString(year, month, day);
    }

    return iso;
  }

  const directDate = new Date(normalized);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  return fetchedDate.toISOString();
}

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
    return resolveV2exUrl(trimmed);
  }

  return `https://${trimmed}`;
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

export function mapMemberProfile(
  parsedProfile: Extract<ParsedV2exMemberProfile, { status: 'found' }>,
): CommunityProfileSnapshot {
  return {
    community: 'v2ex',
    handle: parsedProfile.username,
    displayName: parsedProfile.username,
    avatarUrl: normalizeExternalUrl(parsedProfile.avatarUrl),
    bio: parsedProfile.bio || parsedProfile.tagline || undefined,
    homepageUrl: normalizeExternalUrl(parsedProfile.website) ?? parsedProfile.profileUrl,
    registeredAt:
      parsedProfile.created !== undefined
        ? new Date(parsedProfile.created * 1000).toISOString()
        : undefined,
    stats: {},
  };
}

export function mapReplyActivity(
  item: ParsedV2exReplyItem,
  source: ActivitySourceContext,
  hashService: HashService = new NodeHashService(),
): CanonicalActivity {
  const absoluteUrl = resolveV2exUrl(item.topicUrl);
  const publishedAt = parsePublishedAt(item.publishedAtText, source.fetchedAt, item.publishedAtTitle);
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
    community: 'v2ex',
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
  item: ParsedV2exTopicItem,
  source: ActivitySourceContext,
  hashService: HashService = new NodeHashService(),
): CanonicalActivity {
  const absoluteUrl = resolveV2exUrl(item.topicUrl);
  const publishedAt = parsePublishedAt(item.publishedAtText, source.fetchedAt, item.publishedAtTitle);
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
    community: 'v2ex',
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
