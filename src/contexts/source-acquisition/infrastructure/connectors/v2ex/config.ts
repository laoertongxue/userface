export const V2EX_COMMUNITY = 'v2ex' as const;
export const V2EX_BASE_URL = 'https://www.v2ex.com';

export const V2EX_ROUTE_TEMPLATES = {
  memberProfile: '/api/members/show.json',
  memberReplies: '/member/:username/replies',
  memberTopics: '/member/:username/topics',
} as const;

export const V2EX_DEFAULT_MAX_PAGES = 3;
export const V2EX_MAX_PAGES_PER_FETCH = 3;

export function clampV2exMaxPages(maxPages: number): number {
  return Math.max(1, Math.min(maxPages, V2EX_MAX_PAGES_PER_FETCH));
}

export function resolveV2exUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith('//')) {
    return `https:${pathOrUrl}`;
  }

  return new URL(pathOrUrl, V2EX_BASE_URL).toString();
}

export function buildV2exMemberProfileApiUrl(username: string): string {
  const url = new URL(V2EX_ROUTE_TEMPLATES.memberProfile, V2EX_BASE_URL);
  url.searchParams.set('username', username);
  return url.toString();
}

export function buildV2exMemberRepliesUrl(username: string, page: number): string {
  const url = new URL(
    V2EX_ROUTE_TEMPLATES.memberReplies.replace(':username', encodeURIComponent(username)),
    V2EX_BASE_URL,
  );
  url.searchParams.set('p', String(page));
  return url.toString();
}

export function buildV2exMemberTopicsUrl(username: string, page: number): string {
  const url = new URL(
    V2EX_ROUTE_TEMPLATES.memberTopics.replace(':username', encodeURIComponent(username)),
    V2EX_BASE_URL,
  );
  url.searchParams.set('p', String(page));
  return url.toString();
}
