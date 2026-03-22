import type { AcquisitionContext } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { HttpJsonResponse, HttpTextResponse } from '@/src/contexts/source-acquisition/infrastructure/http/HttpClient';
import { RequestExecutor } from '@/src/contexts/source-acquisition/infrastructure/resilience/RequestExecutor';
import {
  buildV2exMemberProfileApiUrl,
  buildV2exMemberRepliesUrl,
  buildV2exMemberTopicsUrl,
  V2EX_ROUTE_TEMPLATES,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/config';
import {
  buildV2exRateLimitKey,
  V2EX_RATE_LIMIT_POLICY,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/rate-limit';

export type V2exProfilePayload = Record<string, unknown>;

export type V2exFetchedJson<T> = {
  data: T;
  fetchedAt: string;
  route: string;
  url: string;
};

export type V2exFetchedPage = {
  bodyText: string;
  fetchedAt: string;
  page: number;
  route: string;
  url: string;
};

export type V2exExecutorLike = Pick<RequestExecutor, 'executeJson' | 'executeText'>;

function toFetchedJson<T>(
  response: HttpJsonResponse<T>,
  route: string,
): V2exFetchedJson<T> {
  return {
    data: response.data,
    fetchedAt: new Date().toISOString(),
    route,
    url: response.url,
  };
}

function toFetchedPage(
  response: HttpTextResponse,
  route: string,
  page: number,
): V2exFetchedPage {
  return {
    bodyText: response.bodyText,
    fetchedAt: new Date().toISOString(),
    page,
    route,
    url: response.url,
  };
}

export class V2exFetcher {
  constructor(private readonly executor: V2exExecutorLike = new RequestExecutor()) {}

  async fetchMemberProfileJson(
    username: string,
    ctx: AcquisitionContext,
  ): Promise<V2exFetchedJson<V2exProfilePayload>> {
    const response = await this.executor.executeJson<V2exProfilePayload>({
      rateLimitKey: buildV2exRateLimitKey(),
      rateLimitPolicy: V2EX_RATE_LIMIT_POLICY,
      timeoutMs: ctx.timeoutMs,
      url: buildV2exMemberProfileApiUrl(username),
    });

    return toFetchedJson(response, V2EX_ROUTE_TEMPLATES.memberProfile);
  }

  async fetchMemberRepliesPage(
    username: string,
    page: number,
    ctx: AcquisitionContext,
  ): Promise<V2exFetchedPage> {
    const response = await this.executor.executeText({
      rateLimitKey: buildV2exRateLimitKey(),
      rateLimitPolicy: V2EX_RATE_LIMIT_POLICY,
      timeoutMs: ctx.timeoutMs,
      url: buildV2exMemberRepliesUrl(username, page),
    });

    return toFetchedPage(response, V2EX_ROUTE_TEMPLATES.memberReplies, page);
  }

  async fetchMemberTopicsPage(
    username: string,
    page: number,
    ctx: AcquisitionContext,
  ): Promise<V2exFetchedPage> {
    const response = await this.executor.executeText({
      rateLimitKey: buildV2exRateLimitKey(),
      rateLimitPolicy: V2EX_RATE_LIMIT_POLICY,
      timeoutMs: ctx.timeoutMs,
      url: buildV2exMemberTopicsUrl(username, page),
    });

    return toFetchedPage(response, V2EX_ROUTE_TEMPLATES.memberTopics, page);
  }
}
