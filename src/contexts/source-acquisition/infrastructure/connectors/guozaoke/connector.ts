import type {
  AcquisitionContext,
  CanonicalActivity,
  CommunityProfileSnapshot,
  ConnectorProbeResult,
  ConnectorSnapshot,
  ConnectorWarning,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import { AcquisitionError, isAcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import {
  clampGuozaokeMaxPages,
  GUOZAOKE_DEFAULT_MAX_PAGES,
  GUOZAOKE_ROUTE_TEMPLATES,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/config';
import { GuozaokeFetcher } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/fetchers';
import {
  mapReplyActivity,
  mapTopicActivity,
  mapUserProfile,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/mappers';
import {
  GuozaokeParserError,
  parseRepliesPage,
  parseTopicsPage,
  parseUserProfilePage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/parsers';
import { waitForGuozaokeRequestJitter } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/rate-limit';
import type { HashService } from '@/src/shared/contracts/HashService';
import { NodeHashService } from '@/src/shared/contracts/HashService';

type WaitForPageJitter = () => Promise<void>;

type GuozaokeConnectorOptions = {
  fetcher?: Pick<
    GuozaokeFetcher,
    'fetchUserProfilePage' | 'fetchUserRepliesPage' | 'fetchUserTopicsPage'
  >;
  hashService?: HashService;
  waitForPageJitter?: WaitForPageJitter;
};

function buildWarning(code: ConnectorWarning['code'], message: string): ConnectorWarning {
  return {
    code,
    message,
  };
}

function uniqueRoutes(routes: string[]): string[] {
  return [...new Set(routes)];
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof GuozaokeParserError) {
    return error.code === 'NOT_FOUND';
  }

  return isAcquisitionError(error) && error.status === 404;
}

function toProbeWarning(error: unknown, handle: string): ConnectorWarning {
  if (error instanceof GuozaokeParserError) {
    if (error.code === 'SELECTOR_CHANGED') {
      return buildWarning(
        'SELECTOR_CHANGED',
        `Guozaoke profile page structure for "${handle}" did not match the expected selectors.`,
      );
    }

    if (error.code === 'NOT_FOUND') {
      return buildWarning('NOT_FOUND', `Guozaoke user "${handle}" was not found.`);
    }
  }

  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return buildWarning(
        'RATE_LIMITED',
        `Guozaoke rate limited profile probing for "${handle}" and the connector could not recover.`,
      );
    }

    if (error.status === 404) {
      return buildWarning('NOT_FOUND', `Guozaoke user "${handle}" was not found.`);
    }
  }

  return buildWarning(
    'PARTIAL_RESULT',
    `Failed to probe Guozaoke user "${handle}" because the public profile page could not be processed.`,
  );
}

function toProfileWarning(error: unknown, handle: string): ConnectorWarning {
  if (error instanceof GuozaokeParserError) {
    if (error.code === 'SELECTOR_CHANGED') {
      return buildWarning(
        'SELECTOR_CHANGED',
        `Guozaoke profile page structure for "${handle}" did not match the expected selectors.`,
      );
    }

    if (error.code === 'NOT_FOUND') {
      return buildWarning('NOT_FOUND', `Guozaoke user "${handle}" was not found.`);
    }
  }

  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return buildWarning(
        'RATE_LIMITED',
        `Guozaoke rate limited profile retrieval for "${handle}" and the connector could not recover.`,
      );
    }

    if (error.status === 404) {
      return buildWarning('NOT_FOUND', `Guozaoke user "${handle}" was not found.`);
    }
  }

  return buildWarning(
    'PARTIAL_RESULT',
    `Guozaoke profile for user "${handle}" could not be fully retrieved, but other data was preserved.`,
  );
}

function toRepliesWarning(error: unknown, handle: string): ConnectorWarning {
  if (error instanceof GuozaokeParserError) {
    if (error.code === 'SELECTOR_CHANGED') {
      return buildWarning(
        'SELECTOR_CHANGED',
        `Guozaoke replies selector mismatch for "${handle}": expected reply items were not found.`,
      );
    }

    if (error.code === 'NOT_FOUND') {
      return buildWarning(
        'PARTIAL_RESULT',
        `Guozaoke replies page for "${handle}" became unavailable after the profile lookup had already succeeded.`,
      );
    }
  }

  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return buildWarning(
        'RATE_LIMITED',
        `Guozaoke rate limited replies retrieval for "${handle}" and the connector could not recover.`,
      );
    }

    if (error.status === 404) {
      return buildWarning(
        'PARTIAL_RESULT',
        `Guozaoke replies page for "${handle}" returned 404 after the profile lookup had already succeeded.`,
      );
    }
  }

  return buildWarning(
    'PARTIAL_RESULT',
    `Replies for Guozaoke user "${handle}" could not be fully retrieved, but other data was preserved.`,
  );
}

function toTopicsWarning(error: unknown, handle: string): ConnectorWarning {
  if (error instanceof GuozaokeParserError) {
    if (error.code === 'SELECTOR_CHANGED') {
      return buildWarning(
        'SELECTOR_CHANGED',
        `Guozaoke topics selector mismatch for "${handle}": expected topic items were not found.`,
      );
    }

    if (error.code === 'NOT_FOUND') {
      return buildWarning(
        'PARTIAL_RESULT',
        `Guozaoke topics page for "${handle}" became unavailable after the profile lookup had already succeeded.`,
      );
    }
  }

  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return buildWarning(
        'RATE_LIMITED',
        `Guozaoke rate limited topics retrieval for "${handle}" and the connector could not recover.`,
      );
    }

    if (error.status === 404) {
      return buildWarning(
        'PARTIAL_RESULT',
        `Guozaoke topics page for "${handle}" returned 404 after the profile lookup had already succeeded.`,
      );
    }
  }

  return buildWarning(
    'PARTIAL_RESULT',
    `Topics for Guozaoke user "${handle}" could not be fully retrieved, but other data was preserved.`,
  );
}

function sortActivitiesByPublishedAt(activities: CanonicalActivity[]): CanonicalActivity[] {
  return [...activities].sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

export class GuozaokeConnector implements CommunityConnector {
  readonly community = 'guozaoke' as const;
  readonly mode = 'public' as const;
  readonly capabilities = {
    publicProfile: true,
    publicTopics: true,
    publicReplies: true,
    requiresAuth: false,
    supportsPagination: true,
    supportsCrossCommunityHints: false,
  };

  private readonly fetcher: Pick<
    GuozaokeFetcher,
    'fetchUserProfilePage' | 'fetchUserRepliesPage' | 'fetchUserTopicsPage'
  >;
  private readonly hashService: HashService;
  private readonly waitForPageJitter: WaitForPageJitter;

  constructor(options: GuozaokeConnectorOptions = {}) {
    this.fetcher = options.fetcher ?? new GuozaokeFetcher();
    this.hashService = options.hashService ?? new NodeHashService();
    this.waitForPageJitter = options.waitForPageJitter ?? (() => waitForGuozaokeRequestJitter());
  }

  async probe(
    ref: FetchSnapshotInput['ref'],
    ctx: AcquisitionContext,
  ): Promise<ConnectorProbeResult> {
    try {
      const profileResponse = await this.fetcher.fetchUserProfilePage(ref.handle, ctx);
      const parsedProfile = parseUserProfilePage(profileResponse.bodyText);

      if (parsedProfile.status === 'not_found') {
        return {
          ok: false,
          community: this.community,
          ref,
          warnings: [
            buildWarning('NOT_FOUND', `Guozaoke user "${ref.handle}" was not found.`),
          ],
        };
      }

      return {
        ok: true,
        community: this.community,
        ref,
        resolvedUrl: profileResponse.url,
        warnings: [],
      };
    } catch (error) {
      return {
        ok: false,
        community: this.community,
        ref,
        warnings: [toProbeWarning(error, ref.handle)],
      };
    }
  }

  async fetchSnapshot(
    input: FetchSnapshotInput,
    ctx: AcquisitionContext,
  ): Promise<ConnectorSnapshot> {
    const startedAt = Date.now();
    const warnings: ConnectorWarning[] = [];
    const usedRoutes: string[] = [];
    let fetchedPages = 0;
    let degraded = false;
    let profile: CommunityProfileSnapshot | null = null;
    const activities: CanonicalActivity[] = [];
    const maxPages = clampGuozaokeMaxPages(input.window.maxPages || GUOZAOKE_DEFAULT_MAX_PAGES);
    const maxItems = Math.max(1, input.window.maxItems);

    const shouldFetchProfile = input.include.includes('profile');
    const shouldFetchReplies = input.include.includes('replies');
    const shouldFetchTopics = input.include.includes('topics');

    if (shouldFetchProfile) {
      usedRoutes.push(GUOZAOKE_ROUTE_TEMPLATES.userProfile);

      try {
        const profileResponse = await this.fetcher.fetchUserProfilePage(input.ref.handle, ctx);
        const parsedProfile = parseUserProfilePage(profileResponse.bodyText);

        if (parsedProfile.status === 'not_found') {
          warnings.push(
            buildWarning('NOT_FOUND', `Guozaoke user "${input.ref.handle}" was not found.`),
          );

          return {
            ref: input.ref,
            profile: null,
            activities: [],
            diagnostics: {
              fetchedPages: 0,
              fetchedItems: 0,
              elapsedMs: Date.now() - startedAt,
              degraded: true,
              usedRoutes: uniqueRoutes(usedRoutes),
            },
            warnings,
          };
        }

        profile = mapUserProfile(parsedProfile);
        fetchedPages += 1;
      } catch (error) {
        if (isNotFoundError(error)) {
          warnings.push(
            buildWarning('NOT_FOUND', `Guozaoke user "${input.ref.handle}" was not found.`),
          );

          return {
            ref: input.ref,
            profile: null,
            activities: [],
            diagnostics: {
              fetchedPages: 0,
              fetchedItems: 0,
              elapsedMs: Date.now() - startedAt,
              degraded: true,
              usedRoutes: uniqueRoutes(usedRoutes),
            },
            warnings,
          };
        }

        warnings.push(
          toProfileWarning(error, input.ref.handle),
        );
        degraded = true;
      }
    }

    if (shouldFetchReplies) {
      const repliesResult = await this.fetchReplies(input.ref.handle, maxPages, ctx);
      usedRoutes.push(...repliesResult.usedRoutes);
      fetchedPages += repliesResult.fetchedPages;
      degraded = degraded || repliesResult.degraded;
      warnings.push(...repliesResult.warnings);
      activities.push(...repliesResult.activities);

      if (profile && repliesResult.totalReplies !== undefined && profile.stats.replies === undefined) {
        profile.stats.replies = repliesResult.totalReplies;
      }
    }

    if (shouldFetchTopics) {
      const topicsResult = await this.fetchTopics(input.ref.handle, maxPages, ctx);
      usedRoutes.push(...topicsResult.usedRoutes);
      fetchedPages += topicsResult.fetchedPages;
      degraded = degraded || topicsResult.degraded;
      warnings.push(...topicsResult.warnings);
      activities.push(...topicsResult.activities);

      if (profile && topicsResult.totalTopics !== undefined && profile.stats.topics === undefined) {
        profile.stats.topics = topicsResult.totalTopics;
      }
    }

    const finalActivities = sortActivitiesByPublishedAt(activities).slice(0, maxItems);

    return {
      ref: input.ref,
      profile,
      activities: finalActivities,
      diagnostics: {
        fetchedPages,
        fetchedItems: finalActivities.length,
        elapsedMs: Date.now() - startedAt,
        degraded,
        usedRoutes: uniqueRoutes(usedRoutes),
      },
      warnings,
    };
  }

  private async fetchReplies(
    handle: string,
    maxPages: number,
    ctx: AcquisitionContext,
  ): Promise<{
    activities: CanonicalActivity[];
    degraded: boolean;
    fetchedPages: number;
    totalReplies?: number;
    usedRoutes: string[];
    warnings: ConnectorWarning[];
  }> {
    const warnings: ConnectorWarning[] = [];
    const activities: CanonicalActivity[] = [];
    let fetchedPages = 0;
    let degraded = false;
    let totalReplies: number | undefined;
    let totalPages: number | undefined;
    const usedRoutes: string[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      usedRoutes.push(GUOZAOKE_ROUTE_TEMPLATES.userReplies);

      if (page > 1) {
        await this.waitForPageJitter();
      }

      try {
        const pageResponse = await this.fetcher.fetchUserRepliesPage(handle, page, ctx);
        const parsedPage = parseRepliesPage(pageResponse.bodyText);
        fetchedPages += 1;
        totalReplies = parsedPage.totalReplies ?? totalReplies;
        totalPages = parsedPage.totalPages ?? totalPages;
        activities.push(
          ...parsedPage.items.map((item) =>
            mapReplyActivity(
              item,
              {
                fetchedAt: pageResponse.fetchedAt,
                handle,
                route: pageResponse.route,
              },
              this.hashService,
            ),
          ),
        );

        if (parsedPage.items.length === 0 || (totalPages !== undefined && page >= totalPages)) {
          break;
        }
      } catch (error) {
        degraded = true;
        warnings.push(toRepliesWarning(error, handle));
        break;
      }
    }

    return {
      activities,
      degraded,
      fetchedPages,
      totalReplies,
      usedRoutes,
      warnings,
    };
  }

  private async fetchTopics(
    handle: string,
    maxPages: number,
    ctx: AcquisitionContext,
  ): Promise<{
    activities: CanonicalActivity[];
    degraded: boolean;
    fetchedPages: number;
    totalTopics?: number;
    usedRoutes: string[];
    warnings: ConnectorWarning[];
  }> {
    const warnings: ConnectorWarning[] = [];
    const activities: CanonicalActivity[] = [];
    let fetchedPages = 0;
    let degraded = false;
    let totalTopics: number | undefined;
    let totalPages: number | undefined;
    const usedRoutes: string[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      usedRoutes.push(GUOZAOKE_ROUTE_TEMPLATES.userTopics);

      if (page > 1) {
        await this.waitForPageJitter();
      }

      try {
        const pageResponse = await this.fetcher.fetchUserTopicsPage(handle, page, ctx);
        const parsedPage = parseTopicsPage(pageResponse.bodyText);
        fetchedPages += 1;
        totalTopics = parsedPage.totalTopics ?? totalTopics;
        totalPages = parsedPage.totalPages ?? totalPages;
        activities.push(
          ...parsedPage.items.map((item) =>
            mapTopicActivity(
              item,
              {
                fetchedAt: pageResponse.fetchedAt,
                handle,
                route: pageResponse.route,
              },
              this.hashService,
            ),
          ),
        );

        if (parsedPage.items.length === 0 || (totalPages !== undefined && page >= totalPages)) {
          break;
        }
      } catch (error) {
        degraded = true;
        warnings.push(toTopicsWarning(error, handle));
        break;
      }
    }

    return {
      activities,
      degraded,
      fetchedPages,
      totalTopics,
      usedRoutes,
      warnings,
    };
  }
}
