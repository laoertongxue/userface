import { load } from 'cheerio';
import { z } from 'zod';
import { normalizeWhitespace } from '@/src/shared/utils/text';

export type V2exParserErrorCode = 'SELECTOR_CHANGED' | 'TOPICS_HIDDEN' | 'NOT_FOUND';

export class V2exParserError extends Error {
  constructor(
    readonly code: V2exParserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'V2exParserError';
  }
}

const v2exProfileSchema = z
  .object({
    avatar_large: z.string().optional(),
    avatar_normal: z.string().optional(),
    avatar_xlarge: z.string().optional(),
    avatar_xxlarge: z.string().optional(),
    avatar_xxxlarge: z.string().optional(),
    bio: z.string().optional(),
    created: z.number().optional(),
    message: z.string().optional(),
    status: z.string().optional(),
    tagline: z.string().optional(),
    url: z.string().optional(),
    username: z.string().optional(),
    website: z.string().optional(),
  })
  .passthrough();

export type ParsedV2exMemberProfile =
  | {
      status: 'found';
      avatarUrl?: string;
      bio?: string;
      created?: number;
      profileUrl?: string;
      tagline?: string;
      username: string;
      website?: string;
    }
  | {
      status: 'not_found';
    };

export type ParsedV2exReplyItem = {
  contentText: string;
  excerpt: string;
  nodeName?: string;
  publishedAtText: string;
  publishedAtTitle?: string;
  topicTitle: string;
  topicUrl: string;
};

export type ParsedV2exRepliesPage = {
  items: ParsedV2exReplyItem[];
  totalPages?: number;
  totalReplies?: number;
};

export type ParsedV2exTopicItem = {
  contentText: string;
  excerpt: string;
  nodeName?: string;
  publishedAtText: string;
  publishedAtTitle?: string;
  replyCount?: number;
  topicTitle: string;
  topicUrl: string;
};

export type ParsedV2exTopicsPage = {
  items: ParsedV2exTopicItem[];
  totalPages?: number;
  totalTopics?: number;
};

function isExpectedRepliesDocument(documentTitle: string, headerText: string): boolean {
  return documentTitle.includes('所有回复') || headerText.includes('回复总数');
}

function isExpectedTopicsDocument(documentTitle: string, headerText: string): boolean {
  return (
    documentTitle.includes('创建的主题') ||
    documentTitle.includes('全部主题') ||
    headerText.includes('主题总数') ||
    headerText.includes('全部主题')
  );
}

function parseCount(text: string, pattern: RegExp): number | undefined {
  const match = normalizeWhitespace(text).match(pattern);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function parsePageCountFromDocument(html: string): number | undefined {
  const $ = load(html);
  const maxValue = $('.page_input').first().attr('max');
  if (!maxValue) {
    return undefined;
  }

  const parsed = Number(maxValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isMemberNotFoundDocument(html: string): boolean {
  const $ = load(html);
  const title = normalizeWhitespace($('title').text());
  return title.includes('会员未找到') || normalizeWhitespace($('.header').first().text()).includes('会员未找到');
}

function extractReplyContent(containerHtml: string): string {
  return normalizeWhitespace(
    containerHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

export function parseMemberProfileJson(input: unknown): ParsedV2exMemberProfile {
  const parsed = v2exProfileSchema.parse(input);

  if (
    parsed.status === 'error' &&
    typeof parsed.message === 'string' &&
    /Object Not Found/i.test(parsed.message)
  ) {
    return {
      status: 'not_found',
    };
  }

  if (parsed.status !== 'found' || !parsed.username) {
    throw new V2exParserError(
      'SELECTOR_CHANGED',
      'V2EX member profile JSON did not match the expected shape.',
    );
  }

  return {
    status: 'found',
    avatarUrl:
      parsed.avatar_xxxlarge ??
      parsed.avatar_xxlarge ??
      parsed.avatar_xlarge ??
      parsed.avatar_large ??
      parsed.avatar_normal,
    bio: parsed.bio,
    created: parsed.created,
    profileUrl: parsed.url,
    tagline: parsed.tagline,
    username: parsed.username,
    website: parsed.website,
  };
}

export function parseRepliesPage(html: string): ParsedV2exRepliesPage {
  if (isMemberNotFoundDocument(html)) {
    throw new V2exParserError('NOT_FOUND', 'V2EX replies page indicates that the member was not found.');
  }

  const $ = load(html);
  const items: ParsedV2exReplyItem[] = [];

  $('.dock_area').each((_, element) => {
    const dock = $(element);
    const metadataCell = dock.find('td').first();
    const topicLink = metadataCell.find('a[href*="/t/"]').last();
    const nodeLink = metadataCell.find('a[href^="/go/"]').last();
    const publishedAt = normalizeWhitespace(metadataCell.find('.fr .fade').first().text());
    const contentContainer = dock
      .nextAll('.inner, .cell')
      .filter((__, sibling) => $(sibling).find('.reply_content').length > 0)
      .first();
    const replyContent = contentContainer.find('.reply_content').first();
    const topicTitle = normalizeWhitespace(topicLink.text());
    const topicUrl = topicLink.attr('href')?.trim() ?? '';
    const contentHtml = replyContent.html() ?? '';
    const contentText = extractReplyContent(contentHtml);

    if (!topicTitle || !topicUrl || !publishedAt || !contentText) {
      return;
    }

    items.push({
      contentText,
      excerpt: contentText,
      nodeName: normalizeWhitespace(nodeLink.text()) || undefined,
      publishedAtText: publishedAt,
      topicTitle,
      topicUrl,
    });
  });

  const documentTitle = normalizeWhitespace($('title').text());
  const headerText = normalizeWhitespace($('.box .header').first().text());
  const totalPages = parsePageCountFromDocument(html);
  const totalReplies = parseCount(headerText, /回复总数\s*(\d+)/);
  const looksLikeRepliesPage = isExpectedRepliesDocument(documentTitle, headerText);

  if (items.length === 0 && totalReplies === 0) {
    return {
      items: [],
      totalPages,
      totalReplies: 0,
    };
  }

  if (items.length === 0 && looksLikeRepliesPage) {
    throw new V2exParserError(
      'SELECTOR_CHANGED',
      'V2EX replies page selector no longer matched the expected structure.',
    );
  }

  if (items.length === 0) {
    throw new V2exParserError(
      'SELECTOR_CHANGED',
      'V2EX replies page could not be recognized as a valid replies listing.',
    );
  }

  return {
    items,
    totalPages,
    totalReplies,
  };
}

export function parseTopicsPage(html: string): ParsedV2exTopicsPage {
  if (isMemberNotFoundDocument(html)) {
    throw new V2exParserError('NOT_FOUND', 'V2EX topics page indicates that the member was not found.');
  }

  const $ = load(html);
  const items: ParsedV2exTopicItem[] = [];

  $('.cell.item').each((_, element) => {
    const item = $(element);
    const topicLink = item.find('.item_title a.topic-link').first();
    const nodeLink = item.find('.topic_info a.node').first();
    const publishedAtNode = item.find('.topic_info span[title]').first();
    const replyCountNode = item.find('.count_livid, .count_orange').first();
    const topicTitle = normalizeWhitespace(topicLink.text());
    const topicUrl = topicLink.attr('href')?.trim() ?? '';
    const publishedAtText = normalizeWhitespace(publishedAtNode.text());
    const publishedAtTitle = publishedAtNode.attr('title')?.trim();
    const replyCountText = normalizeWhitespace(replyCountNode.text());
    const replyCount = /^\d+$/.test(replyCountText) ? Number(replyCountText) : undefined;

    if (!topicTitle || !topicUrl || !publishedAtText) {
      return;
    }

    items.push({
      contentText: topicTitle,
      excerpt: topicTitle,
      nodeName: normalizeWhitespace(nodeLink.text()) || undefined,
      publishedAtText,
      publishedAtTitle,
      replyCount,
      topicTitle,
      topicUrl,
    });
  });

  const documentTitle = normalizeWhitespace($('title').text());
  const headerText = normalizeWhitespace($('.box .header').first().text());
  const totalPages = parsePageCountFromDocument(html);
  const totalTopics = parseCount(headerText, /主题总数\s*(\d+)/);
  const looksLikeTopicsPage = isExpectedTopicsDocument(documentTitle, headerText);

  if (items.length === 0 && totalTopics === 0) {
    return {
      items: [],
      totalPages,
      totalTopics: 0,
    };
  }

  if (items.length === 0 && looksLikeTopicsPage) {
    throw new V2exParserError(
      'SELECTOR_CHANGED',
      'V2EX topics page parsed zero items while page structure appears changed.',
    );
  }

  if (items.length === 0) {
    throw new V2exParserError(
      'TOPICS_HIDDEN',
      'V2EX topics page was not available or did not expose topic items.',
    );
  }

  return {
    items,
    totalPages,
    totalTopics,
  };
}
