import { AcquisitionError } from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import {
  HttpClient,
  parseJsonResponse,
  type HttpJsonResponse,
  type HttpRequestOptions,
  type HttpTextResponse,
} from '@/src/contexts/source-acquisition/infrastructure/http/HttpClient';
import { buildDefaultHeaders } from '@/src/contexts/source-acquisition/infrastructure/http/headers';
import { BottleneckRateLimiter } from '@/src/contexts/source-acquisition/infrastructure/resilience/BottleneckRateLimiter';
import type { RateLimiter, RateLimitPolicy } from '@/src/contexts/source-acquisition/infrastructure/resilience/RateLimiter';
import { RetryPolicy, type RetryPolicyOptions } from '@/src/contexts/source-acquisition/infrastructure/resilience/RetryPolicy';

export type RequestExecutionOptions = HttpRequestOptions & {
  accept?: string;
  rateLimitKey?: string;
  rateLimitPolicy?: RateLimitPolicy;
  retryPolicy?: RetryPolicyOptions;
  userAgent?: string;
};

type RequestExecutorOptions = {
  defaultTimeoutMs?: number;
  httpClient?: HttpClient;
  rateLimiter?: RateLimiter;
  retryPolicy?: RetryPolicy;
  userAgent?: string;
};

export class RequestExecutor {
  private readonly defaultTimeoutMs?: number;
  private readonly httpClient: HttpClient;
  private readonly rateLimiter: RateLimiter;
  private readonly retryPolicy: RetryPolicy;
  private readonly userAgent?: string;

  constructor(options: RequestExecutorOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.httpClient = options.httpClient ?? new HttpClient();
    this.rateLimiter = options.rateLimiter ?? new BottleneckRateLimiter();
    this.retryPolicy = options.retryPolicy ?? new RetryPolicy();
    this.userAgent = options.userAgent;
  }

  async executeText(options: RequestExecutionOptions): Promise<HttpTextResponse> {
    return this.retryPolicy.execute(
      async () => {
        const response = await this.scheduleIfNeeded(
          options,
          () =>
            this.httpClient.fetchText({
            ...options,
            headers: buildDefaultHeaders({
              accept: options.accept,
              headers: options.headers,
              userAgent: options.userAgent ?? this.userAgent,
            }),
            timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
            }),
        );

        if (!response.ok) {
          throw AcquisitionError.fromStatus(response.status, response.url);
        }

        return response;
      },
      options.retryPolicy,
    );
  }

  async executeJson<T>(options: RequestExecutionOptions): Promise<HttpJsonResponse<T>> {
    const response = await this.executeText({
      ...options,
      accept: options.accept ?? 'application/json, */*;q=0.8',
    });

    return parseJsonResponse<T>(response);
  }

  private scheduleIfNeeded<T>(
    options: RequestExecutionOptions,
    task: () => Promise<T>,
  ): Promise<T> {
    if (!options.rateLimitKey || !options.rateLimitPolicy) {
      return task();
    }

    return this.rateLimiter.schedule(options.rateLimitKey, options.rateLimitPolicy, task);
  }
}
