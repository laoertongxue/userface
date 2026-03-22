export const GUOZAOKE_COMMUNITY = 'guozaoke' as const;
export const GUOZAOKE_BASE_URL = 'https://www.guozaoke.com';

export const GUOZAOKE_ROUTE_TEMPLATES = {
  userProfile: '/u/:id',
  userReplies: '/u/:id/replies',
  userTopics: '/u/:id/topics',
} as const;

export const GUOZAOKE_DEFAULT_MAX_PAGES = 3;
export const GUOZAOKE_MAX_PAGES_PER_FETCH = 3;

export function clampGuozaokeMaxPages(maxPages: number): number {
  return Math.max(1, Math.min(maxPages, GUOZAOKE_MAX_PAGES_PER_FETCH));
}

export function resolveGuozaokeUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith('//')) {
    return `https:${pathOrUrl}`;
  }

  return new URL(pathOrUrl, GUOZAOKE_BASE_URL).toString();
}

export function buildGuozaokeUserProfileUrl(handle: string): string {
  return new URL(
    GUOZAOKE_ROUTE_TEMPLATES.userProfile.replace(':id', encodeURIComponent(handle)),
    GUOZAOKE_BASE_URL,
  ).toString();
}

export function buildGuozaokeUserRepliesUrl(handle: string, page: number): string {
  const url = new URL(
    GUOZAOKE_ROUTE_TEMPLATES.userReplies.replace(':id', encodeURIComponent(handle)),
    GUOZAOKE_BASE_URL,
  );
  url.searchParams.set('p', String(page));
  return url.toString();
}

export function buildGuozaokeUserTopicsUrl(handle: string, page: number): string {
  const url = new URL(
    GUOZAOKE_ROUTE_TEMPLATES.userTopics.replace(':id', encodeURIComponent(handle)),
    GUOZAOKE_BASE_URL,
  );
  url.searchParams.set('p', String(page));
  return url.toString();
}
