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
  clampV2exMaxPages,
  V2EX_DEFAULT_MAX_PAGES,
  V2EX_ROUTE_TEMPLATES,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/config';
import { V2exFetcher } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/fetchers';
import {
  mapMemberProfile,
  mapReplyActivity,
  mapTopicActivity,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/mappers';
import {
  parseMemberProfileJson,
  parseRepliesPage,
  parseTopicsPage,
  V2exParserError,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';
import { waitForV2exRequestJitter } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/rate-limit';
import type { HashService } from '@/src/shared/contracts/HashService';
import { NodeHashService } from '@/src/shared/contracts/HashService';

type WaitForPageJitter = () => Promise<void>;

type V2exConnectorOptions = {
  fetcher?: Pick<
    V2exFetcher,
    'fetchMemberProfileJson' | 'fetchMemberRepliesPage' | 'fetchMemberTopicsPage'
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
  if (error instanceof V2exParserError) {
    return error.code === 'NOT_FOUND';
  }

  return isAcquisitionError(error) && error.status === 404;
}

function toPartialWarning(error: unknown, message: string): ConnectorWarning {
  if (error instanceof V2exParserError) {
    if (error.code === 'SELECTOR_CHANGED') {
      return buildWarning('SELECTOR_CHANGED', error.message);
    }

    if (error.code === 'NOT_FOUND') {
      return buildWarning('NOT_FOUND', error.message);
    }
  }

  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return buildWarning('RATE_LIMITED', message);
    }

    if (error.status === 404) {
      return buildWarning('NOT_FOUND', message);
    }
  }

  return buildWarning('PARTIAL_RESULT', message);
}

function toTopicsWarning(error: unknown, handle: string): ConnectorWarning {
  if (error instanceof V2exParserError) {
    if (error.code === 'TOPICS_HIDDEN') {
      return buildWarning(
        'TOPICS_HIDDEN',
        `Topics for V2EX member "${handle}" were not available or not publicly visible.`,
      );
    }

    if (error.code === 'SELECTOR_CHANGED') {
      return buildWarning(
        'SELECTOR_CHANGED',
        `V2EX topics page structure for "${handle}" did not match the expected selectors.`,
      );
    }
  }

  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return buildWarning(
        'RATE_LIMITED',
        `V2EX rate limited topics retrieval for "${handle}" and the connector could not recover.`,
      );
    }

    if (error.status === 403 || error.status === 404) {
      return buildWarning(
        'TOPICS_HIDDEN',
        `Topics for V2EX member "${handle}" were not publicly accessible.`,
      );
    }
  }

  return buildWarning(
    'PARTIAL_RESULT',
    `Topics for V2EX member "${handle}" could not be fully retrieved, but other data was preserved.`,
  );
}

function sortActivitiesByPublishedAt(activities: CanonicalActivity[]): CanonicalActivity[] {
  return [...activities].sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

export class V2exConnector implements CommunityConnector {
  readonly community = 'v2ex' as const;
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
    V2exFetcher,
    'fetchMemberProfileJson' | 'fetchMemberRepliesPage' | 'fetchMemberTopicsPage'
  >;
  private readonly hashService: HashService;
  private readonly waitForPageJitter: WaitForPageJitter;

  constructor(options: V2exConnectorOptions = {}) {
    this.fetcher = options.fetcher ?? new V2exFetcher();
    this.hashService = options.hashService ?? new NodeHashService();
    this.waitForPageJitter = options.waitForPageJitter ?? (() => waitForV2exRequestJitter());
  }

  async probe(
    ref: FetchSnapshotInput['ref'],
    ctx: AcquisitionContext,
  ): Promise<ConnectorProbeResult> {
    try {
      const profileResponse = await this.fetcher.fetchMemberProfileJson(ref.handle, ctx);
      const parsedProfile = parseMemberProfileJson(profileResponse.data);

      if (parsedProfile.status === 'not_found') {
        return {
          ok: false,
          community: this.community,
          ref,
          warnings: [
            buildWarning('NOT_FOUND', `V2EX member "${ref.handle}" was not found.`),
          ],
        };
      }

      return {
        ok: true,
        community: this.community,
        ref,
        resolvedUrl: parsedProfile.profileUrl,
        warnings: [],
      };
    } catch (error) {
      return {
        ok: false,
        community: this.community,
        ref,
        warnings: [
          toPartialWarning(error, `Failed to probe V2EX member "${ref.handle}".`),
        ],
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
    const maxPages = clampV2exMaxPages(input.window.maxPages || V2EX_DEFAULT_MAX_PAGES);
    const maxItems = Math.max(1, input.window.maxItems);

    const shouldFetchProfile = input.include.includes('profile');
    const shouldFetchReplies = input.include.includes('replies');
    const shouldFetchTopics = input.include.includes('topics');

    if (shouldFetchProfile) {
      usedRoutes.push(V2EX_ROUTE_TEMPLATES.memberProfile);

      try {
        const profileResponse = await this.fetcher.fetchMemberProfileJson(input.ref.handle, ctx);
        const parsedProfile = parseMemberProfileJson(profileResponse.data);

        if (parsedProfile.status === 'not_found') {
          warnings.push(
            buildWarning('NOT_FOUND', `V2EX member "${input.ref.handle}" was not found.`),
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

        profile = mapMemberProfile(parsedProfile);
        fetchedPages += 1;
      } catch (error) {
        if (isNotFoundError(error)) {
          warnings.push(
            buildWarning('NOT_FOUND', `V2EX member "${input.ref.handle}" was not found.`),
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
          toPartialWarning(
            error,
            `V2EX profile for member "${input.ref.handle}" could not be retrieved.`,
          ),
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

      if (profile && repliesResult.totalReplies !== undefined) {
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

      if (profile && topicsResult.totalTopics !== undefined) {
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
    const usedRoutes: string[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      usedRoutes.push(V2EX_ROUTE_TEMPLATES.memberReplies);

      if (page > 1) {
        await this.waitForPageJitter();
      }

      try {
        const pageResponse = await this.fetcher.fetchMemberRepliesPage(handle, page, ctx);
        const parsedPage = parseRepliesPage(pageResponse.bodyText);
        fetchedPages += 1;
        totalReplies = parsedPage.totalReplies ?? totalReplies;
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

        if (parsedPage.items.length === 0) {
          break;
        }
      } catch (error) {
        degraded = true;
        warnings.push(
          toPartialWarning(
            error,
            `Replies for V2EX member "${handle}" could not be fully retrieved, but other data was preserved.`,
          ),
        );
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
    const usedRoutes: string[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      usedRoutes.push(V2EX_ROUTE_TEMPLATES.memberTopics);

      if (page > 1) {
        await this.waitForPageJitter();
      }

      try {
        const pageResponse = await this.fetcher.fetchMemberTopicsPage(handle, page, ctx);
        const parsedPage = parseTopicsPage(pageResponse.bodyText);
        fetchedPages += 1;
        totalTopics = parsedPage.totalTopics ?? totalTopics;
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

        if (parsedPage.items.length === 0) {
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
