import type { AcquisitionContext } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { HttpTextResponse } from '@/src/contexts/source-acquisition/infrastructure/http/HttpClient';
import { RequestExecutor } from '@/src/contexts/source-acquisition/infrastructure/resilience/RequestExecutor';
import {
  buildGuozaokeUserProfileUrl,
  buildGuozaokeUserRepliesUrl,
  buildGuozaokeUserTopicsUrl,
  GUOZAOKE_ROUTE_TEMPLATES,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/config';
import {
  buildGuozaokeRateLimitKey,
  GUOZAOKE_RATE_LIMIT_POLICY,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/rate-limit';

export type GuozaokeFetchedPage = {
  bodyText: string;
  fetchedAt: string;
  page?: number;
  route: string;
  url: string;
};

export type GuozaokeExecutorLike = Pick<RequestExecutor, 'executeText'>;

function toFetchedPage(
  response: HttpTextResponse,
  route: string,
  page?: number,
): GuozaokeFetchedPage {
  return {
    bodyText: response.bodyText,
    fetchedAt: new Date().toISOString(),
    page,
    route,
    url: response.url,
  };
}

export class GuozaokeFetcher {
  constructor(private readonly executor: GuozaokeExecutorLike = new RequestExecutor()) {}

  async fetchUserProfilePage(
    handle: string,
    ctx: AcquisitionContext,
  ): Promise<GuozaokeFetchedPage> {
    const response = await this.executor.executeText({
      rateLimitKey: buildGuozaokeRateLimitKey(),
      rateLimitPolicy: GUOZAOKE_RATE_LIMIT_POLICY,
      timeoutMs: ctx.timeoutMs,
      url: buildGuozaokeUserProfileUrl(handle),
    });

    return toFetchedPage(response, GUOZAOKE_ROUTE_TEMPLATES.userProfile);
  }

  async fetchUserRepliesPage(
    handle: string,
    page: number,
    ctx: AcquisitionContext,
  ): Promise<GuozaokeFetchedPage> {
    const response = await this.executor.executeText({
      rateLimitKey: buildGuozaokeRateLimitKey(),
      rateLimitPolicy: GUOZAOKE_RATE_LIMIT_POLICY,
      timeoutMs: ctx.timeoutMs,
      url: buildGuozaokeUserRepliesUrl(handle, page),
    });

    return toFetchedPage(response, GUOZAOKE_ROUTE_TEMPLATES.userReplies, page);
  }

  async fetchUserTopicsPage(
    handle: string,
    page: number,
    ctx: AcquisitionContext,
  ): Promise<GuozaokeFetchedPage> {
    const response = await this.executor.executeText({
      rateLimitKey: buildGuozaokeRateLimitKey(),
      rateLimitPolicy: GUOZAOKE_RATE_LIMIT_POLICY,
      timeoutMs: ctx.timeoutMs,
      url: buildGuozaokeUserTopicsUrl(handle, page),
    });

    return toFetchedPage(response, GUOZAOKE_ROUTE_TEMPLATES.userTopics, page);
  }
}
