import { load } from 'cheerio';
import { normalizeWhitespace } from '@/src/shared/utils/text';

export type GuozaokeParserErrorCode = 'NOT_FOUND' | 'SELECTOR_CHANGED' | 'TOPICS_HIDDEN';

export class GuozaokeParserError extends Error {
  constructor(
    readonly code: GuozaokeParserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GuozaokeParserError';
  }
}

export type ParsedGuozaokeUserProfile =
  | {
      status: 'found';
      avatarUrl?: string;
      bio?: string;
      displayName?: string;
      handle: string;
      homepageUrl?: string;
      profileUrl?: string;
      registeredAtText?: string;
      stats: {
        favorites?: number;
        replies?: number;
        topics?: number;
      };
    }
  | {
      status: 'not_found';
    };

export type ParsedGuozaokeReplyItem = {
  contentText: string;
  excerpt: string;
  nodeName?: string;
  publishedAtText?: string;
  topicTitle: string;
  topicUrl: string;
};

export type ParsedGuozaokeRepliesPage = {
  items: ParsedGuozaokeReplyItem[];
  totalPages?: number;
  totalReplies?: number;
};

export type ParsedGuozaokeTopicItem = {
  contentText: string;
  excerpt: string;
  nodeName?: string;
  publishedAtText?: string;
  replyCount?: number;
  topicTitle: string;
  topicUrl: string;
};

export type ParsedGuozaokeTopicsPage = {
  items: ParsedGuozaokeTopicItem[];
  totalPages?: number;
  totalTopics?: number;
};

type ParsedField = {
  href?: string;
  text: string;
};

function containsAnyText(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function isNotFoundDocument(html: string): boolean {
  const $ = load(html);
  const title = normalizeWhitespace($('title').text());
  const bodyText = normalizeWhitespace($('body').text());
  return title.includes('404: OK') || bodyText === '404: OK';
}

function extractRichText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function parsePaginationTotalPages(html: string): number | undefined {
  const $ = load(html);
  const pageNumbers = $('.pagination a')
    .map((_, element) => {
      const text = normalizeWhitespace($(element).text());
      return /^\d+$/.test(text) ? Number(text) : undefined;
    })
    .get()
    .filter((value): value is number => value !== undefined);

  if (pageNumbers.length === 0) {
    return undefined;
  }

  return Math.max(...pageNumbers);
}

function parseStatusCount(
  html: string,
  selector: '.status-topic' | '.status-reply' | '.status-favorite',
): number | undefined {
  const $ = load(html);
  const text = normalizeWhitespace($(`.usercard ${selector} strong`).first().text());
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

function isExplicitlyEmptyRepliesPage(html: string): boolean {
  const $ = load(html);
  const pageText = normalizeWhitespace($('.user-replies, .replies-lists').first().text());
  const totalReplies = parseStatusCount(html, '.status-reply');

  if (totalReplies === 0) {
    return true;
  }

  return containsAnyText(pageText, [
    '暂无回复',
    '还没有回复',
    '没有回复',
    '回复列表为空',
  ]);
}

function isExplicitlyEmptyTopicsPage(html: string): boolean {
  const $ = load(html);
  const pageText = normalizeWhitespace($('.user-topics, .topic-lists').first().text());
  const totalTopics = parseStatusCount(html, '.status-topic');

  if (totalTopics === 0) {
    return true;
  }

  return containsAnyText(pageText, [
    '暂无主题',
    '还没有主题',
    '没有主题',
    '主题列表为空',
  ]);
}

function isUnavailableTopicsPage(html: string): boolean {
  const $ = load(html);
  const topicsRoot = $('.user-topics, .topic-lists').first();
  const topicsContent = topicsRoot.find('.ui-content').first();
  const topicItems = topicsRoot.find('.topic-item');
  const totalTopics = parseStatusCount(html, '.status-topic');
  const pageText = normalizeWhitespace(topicsContent.text());

  if (!topicsRoot.length || topicItems.length > 0) {
    return false;
  }

  if (containsAnyText(pageText, ['仅自己可见', '需要登录', '暂无权限', '无权限查看', '不可见'])) {
    return true;
  }

  return Boolean(topicsContent.length && !pageText && totalTopics && totalTopics > 0);
}

function collectProfileFields(html: string): Record<string, ParsedField> {
  const $ = load(html);
  const fields: Record<string, ParsedField> = {};

  $('.profile .ui-content dl').each((_, element) => {
    const field = $(element);
    const key = normalizeWhitespace(field.find('dt').first().text());
    const valueNode = field.find('dd').first();
    const text = normalizeWhitespace(valueNode.text());
    const href = valueNode.find('a[href]').first().attr('href')?.trim();

    if (!key || !text) {
      return;
    }

    fields[key] = {
      href,
      text,
    };
  });

  return fields;
}

function findFieldValue(
  fields: Record<string, ParsedField>,
  labels: string[],
): ParsedField | undefined {
  return labels
    .map((label) => fields[label])
    .find((field): field is ParsedField => field !== undefined);
}

function extractTopicTitle(titleNodeHtml: string): string {
  const $ = load(`<div>${titleNodeHtml}</div>`);
  $('i').remove();
  return normalizeWhitespace($.root().text());
}

export function parseUserProfilePage(html: string): ParsedGuozaokeUserProfile {
  if (isNotFoundDocument(html)) {
    return {
      status: 'not_found',
    };
  }

  const $ = load(html);
  const profileRoot = $('.user-page .profile').first();
  const username = normalizeWhitespace(profileRoot.find('.username').first().text());
  const displayName =
    normalizeWhitespace(profileRoot.find('.display-name').first().text()) || undefined;
  const avatarUrl = profileRoot.find('.ui-header a[href^="/u/"] img.avatar').first().attr('src')?.trim();
  const profileUrl = profileRoot.find('.ui-header a[href^="/u/"]').first().attr('href')?.trim();
  const sinceText = normalizeWhitespace(profileRoot.find('.user-number .since').first().text());
  const registeredAtText = sinceText.replace(/^入住于\s*/, '').trim() || undefined;
  const fields = collectProfileFields(html);
  const idField = findFieldValue(fields, ['ID', '账号']);
  const bioField = findFieldValue(fields, ['签名', '简介', '个人简介', 'Bio']);
  const homepageField = findFieldValue(fields, ['个人主页', '主页', '网站', '博客', 'Homepage']);
  const handle = username || idField?.text;

  if (!profileRoot.length) {
    throw new GuozaokeParserError(
      'SELECTOR_CHANGED',
      'Guozaoke profile page structure was unexpected: missing profile root.',
    );
  }

  if (!handle) {
    throw new GuozaokeParserError(
      'SELECTOR_CHANGED',
      'Guozaoke profile page structure was unexpected: missing user handle.',
    );
  }

  return {
    status: 'found',
    avatarUrl,
    bio: bioField?.text,
    displayName,
    handle,
    homepageUrl: homepageField?.href ?? homepageField?.text,
    profileUrl,
    registeredAtText,
    stats: {
      favorites: parseStatusCount(html, '.status-favorite'),
      replies: parseStatusCount(html, '.status-reply'),
      topics: parseStatusCount(html, '.status-topic'),
    },
  };
}

export function parseRepliesPage(html: string): ParsedGuozaokeRepliesPage {
  if (isNotFoundDocument(html)) {
    throw new GuozaokeParserError('NOT_FOUND', 'Guozaoke replies page indicates that the user was not found.');
  }

  const $ = load(html);
  const items: ParsedGuozaokeReplyItem[] = [];

  $('.user-replies .reply-item, .replies-lists .reply-item').each((_, element) => {
    const item = $(element);
    const titleNode = item.find('.title').first();
    const topicLink = titleNode.find('a[href*="/t/"]').first();
    const topicTitle = normalizeWhitespace(topicLink.text());
    const topicUrl = topicLink.attr('href')?.trim() ?? '';
    const contentHtml = item.find('.content').first().html() ?? '';
    const contentText = extractRichText(contentHtml);
    const metadataNode = item.find('.meta').first();
    const publishedAtText =
      item.attr('data-published-at')?.trim() ||
      normalizeWhitespace(
        metadataNode.find('.reply-time, .last-touched').first().text() ||
          titleNode.find('.reply-time, .last-touched').first().text(),
      ) ||
      undefined;
    const nodeName =
      normalizeWhitespace(
        metadataNode.find('.node a').first().text() ||
          titleNode.find('.node a, a[href*="/node/"]').first().text(),
      ) || undefined;

    if (!topicTitle || !topicUrl || !contentText) {
      return;
    }

    items.push({
      contentText,
      excerpt: contentText,
      nodeName,
      publishedAtText,
      topicTitle,
      topicUrl,
    });
  });

  const looksLikeRepliesPage =
    normalizeWhitespace($('.bread-nav').first().text()).includes('回复列表') ||
    $('.user-replies, .replies-lists').length > 0;
  const totalReplies = parseStatusCount(html, '.status-reply');
  const totalPages = parsePaginationTotalPages(html);

  if (items.length === 0 && isExplicitlyEmptyRepliesPage(html)) {
    return {
      items: [],
      totalPages,
      totalReplies: totalReplies ?? 0,
    };
  }

  if (items.length === 0 && looksLikeRepliesPage) {
    throw new GuozaokeParserError(
      'SELECTOR_CHANGED',
      'Guozaoke replies selector mismatch: expected reply items were not found.',
    );
  }

  if (items.length === 0) {
    throw new GuozaokeParserError(
      'SELECTOR_CHANGED',
      'Guozaoke replies page could not be recognized as a valid replies listing.',
    );
  }

  return {
    items,
    totalPages,
    totalReplies,
  };
}

export function parseTopicsPage(html: string): ParsedGuozaokeTopicsPage {
  if (isNotFoundDocument(html)) {
    throw new GuozaokeParserError('NOT_FOUND', 'Guozaoke topics page indicates that the user was not found.');
  }

  if (isUnavailableTopicsPage(html)) {
    throw new GuozaokeParserError(
      'TOPICS_HIDDEN',
      'Guozaoke topics page indicates that additional topics were not publicly visible.',
    );
  }

  const $ = load(html);
  const items: ParsedGuozaokeTopicItem[] = [];

  $('.user-topics .topic-item, .topic-lists .topic-item').each((_, element) => {
    const item = $(element);
    const topicLink = item.find('.title a[href*="/t/"]').first();
    const topicTitle = extractTopicTitle(topicLink.html() ?? topicLink.text());
    const topicUrl = topicLink.attr('href')?.trim() ?? '';
    const nodeName = normalizeWhitespace(item.find('.meta .node a').first().text()) || undefined;
    const publishedAtText =
      normalizeWhitespace(item.find('.meta .last-touched').first().text()) || undefined;
    const replyCountText = normalizeWhitespace(item.find('.count a').first().text());
    const replyCount = /^\d+$/.test(replyCountText) ? Number(replyCountText) : undefined;

    if (!topicTitle || !topicUrl) {
      return;
    }

    items.push({
      contentText: topicTitle,
      excerpt: topicTitle,
      nodeName,
      publishedAtText,
      replyCount,
      topicTitle,
      topicUrl,
    });
  });

  const looksLikeTopicsPage =
    normalizeWhitespace($('.bread-nav').first().text()).includes('主题列表') ||
    $('.user-topics, .topic-lists').length > 0;
  const totalTopics = parseStatusCount(html, '.status-topic');
  const totalPages = parsePaginationTotalPages(html);

  if (items.length === 0 && isExplicitlyEmptyTopicsPage(html)) {
    return {
      items: [],
      totalPages,
      totalTopics: totalTopics ?? 0,
    };
  }

  if (items.length === 0 && looksLikeTopicsPage) {
    throw new GuozaokeParserError(
      'SELECTOR_CHANGED',
      'Guozaoke topics selector mismatch: expected topic items were not found.',
    );
  }

  if (items.length === 0) {
    throw new GuozaokeParserError(
      'SELECTOR_CHANGED',
      'Guozaoke topics page could not be recognized as a valid topics listing.',
    );
  }

  return {
    items,
    totalPages,
    totalTopics,
  };
}
