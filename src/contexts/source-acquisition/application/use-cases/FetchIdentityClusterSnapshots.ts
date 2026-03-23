import type {
  AcquisitionContext,
  ConnectorSnapshot,
  ConnectorWarningCode,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { IdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import {
  isAcquisitionError,
} from '@/src/contexts/source-acquisition/infrastructure/errors/AcquisitionError';
import { analysisConfig } from '@/src/config/analysis';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import {
  normalizeErrorCode,
} from '@/src/contexts/platform-governance/infrastructure/observability/ErrorCodeCatalog';
import {
  observabilityEvents,
} from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';
import { hashIdentifier } from '@/src/contexts/platform-governance/infrastructure/observability/RedactionPolicy';

export type FetchIdentityClusterSnapshotsInput = {
  identityCluster: IdentityCluster;
  options?: {
    maxPagesPerCommunity?: number;
    maxItemsPerCommunity?: number;
    includeTopics?: boolean;
    includeReplies?: boolean;
    locale?: 'zh-CN' | 'en-US';
  };
};

export type ClusterAccountFetchFailure = {
  account: ClusterAccountRef;
  code: Extract<ConnectorWarningCode, 'NOT_FOUND' | 'PARTIAL_RESULT' | 'RATE_LIMITED' | 'UNSUPPORTED'>;
  message: string;
};

export type SuccessfulClusterSnapshot = {
  account: ClusterAccountRef;
  snapshot: ConnectorSnapshot;
};

export type FetchIdentityClusterSnapshotsResult = {
  identityCluster: IdentityCluster;
  successfulSnapshots: SuccessfulClusterSnapshot[];
  failedAccounts: ClusterAccountFetchFailure[];
  totalAccounts: number;
  successfulCount: number;
  failedCount: number;
  degraded: boolean;
};

const CLUSTER_FETCH_CONCURRENCY = 2;

function clusterAccountKey(account: ClusterAccountRef): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

function dedupeAccounts(accounts: ClusterAccountRef[]): ClusterAccountRef[] {
  const seen = new Set<string>();

  return accounts.filter((account) => {
    const key = clusterAccountKey(account);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function mapWithConcurrency<T, Result>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );

  return results;
}

function failureFromError(account: ClusterAccountRef, error: unknown): ClusterAccountFetchFailure {
  if (isAcquisitionError(error)) {
    if (error.code === 'RATE_LIMITED') {
      return {
        account,
        code: 'RATE_LIMITED',
        message: `Failed to fetch ${account.community}:${account.handle} because the upstream source rate limited the request.`,
      };
    }
  }

  return {
    account,
    code: 'PARTIAL_RESULT',
    message: `Failed to fetch ${account.community}:${account.handle} for cluster analysis.`,
  };
}

function failureFromSnapshot(
  account: ClusterAccountRef,
  snapshot: ConnectorSnapshot,
): ClusterAccountFetchFailure | null {
  if (snapshot.profile || snapshot.activities.length > 0) {
    return null;
  }

  const warning =
    snapshot.warnings.find((entry) =>
      ['NOT_FOUND', 'RATE_LIMITED', 'UNSUPPORTED', 'PARTIAL_RESULT'].includes(entry.code),
    ) ?? null;

  if (!warning) {
    return null;
  }

  return {
    account,
    code:
      warning.code === 'NOT_FOUND' ||
      warning.code === 'RATE_LIMITED' ||
      warning.code === 'UNSUPPORTED'
        ? warning.code
        : 'PARTIAL_RESULT',
    message: warning.message,
  };
}

export class FetchIdentityClusterSnapshots {
  constructor(private readonly connectorRegistry: ConnectorRegistry) {}

  async execute(
    input: FetchIdentityClusterSnapshotsInput,
    ctx: AcquisitionContext,
  ): Promise<FetchIdentityClusterSnapshotsResult> {
    const observability = ctx.observability?.child('connector.fetch');
    const span = observability?.startSpan('connector.fetch');
    const maxPages =
      input.options?.maxPagesPerCommunity ?? analysisConfig.defaults.maxPagesPerCommunity;
    const maxItems =
      input.options?.maxItemsPerCommunity ?? analysisConfig.defaults.maxItemsPerCommunity;
    const includeTopics = input.options?.includeTopics ?? analysisConfig.defaults.includeTopics;
    const includeReplies = input.options?.includeReplies ?? analysisConfig.defaults.includeReplies;
    const dedupedAccounts = dedupeAccounts(input.identityCluster.accounts);

    const settled = await mapWithConcurrency(
      dedupedAccounts,
      CLUSTER_FETCH_CONCURRENCY,
      async (account) => {
        const accountSpan = observability?.startSpan(`connector.fetch.${account.community}`);
        observability?.logger.event(observabilityEvents.connectorFetchStarted, {
          message: 'Connector snapshot fetch started.',
          context: {
            community: account.community,
            accountHash: hashIdentifier(`${account.community}:${account.handle}`),
            includeTopics,
            includeReplies,
          },
        });

        try {
          const snapshot = await this.connectorRegistry.get(account.community).fetchSnapshot(
            {
              ref: account,
              window: {
                maxPages,
                maxItems,
              },
              include: [
                'profile',
                ...(includeTopics ? (['topics'] as const) : []),
                ...(includeReplies ? (['replies'] as const) : []),
              ],
            },
            ctx,
          );
          const snapshotFailure = failureFromSnapshot(account, snapshot);

          if (snapshotFailure) {
            const partialDuration = accountSpan?.finish('partial');
            observability?.logger.event(observabilityEvents.connectorPartialResult, {
              level: 'warn',
              message: 'Connector returned a partial or empty snapshot.',
              errorCode: normalizeErrorCode({ warningCode: snapshotFailure.code }),
              context: {
                community: account.community,
                accountHash: hashIdentifier(`${account.community}:${account.handle}`),
                warningCode: snapshotFailure.code,
                degraded: snapshot.diagnostics.degraded,
                durationMs: partialDuration?.durationMs,
              },
            });
            observability?.metrics.counter(metricNames.connectorPartialResultTotal, 1, {
              community: account.community,
              outcome: 'partial',
            });
            observability?.metrics.counter(metricNames.connectorFetchTotal, 1, {
              community: account.community,
              outcome: 'partial',
            });
            if (partialDuration) {
              observability?.metrics.timing(metricNames.connectorFetchDurationMs, partialDuration.durationMs, {
                community: account.community,
                outcome: 'partial',
              });
            }

            return {
              status: 'failed' as const,
              failure: snapshotFailure,
            };
          }

          const completedSpan = accountSpan?.finish(
            snapshot.diagnostics.degraded || snapshot.warnings.length > 0 ? 'partial' : 'success',
          );
          observability?.logger.event(observabilityEvents.connectorFetchCompleted, {
            message: 'Connector snapshot fetch completed.',
            context: {
              community: account.community,
              accountHash: hashIdentifier(`${account.community}:${account.handle}`),
              activityCount: snapshot.activities.length,
              warningCodes: snapshot.warnings.map((warning) => warning.code),
              degraded: snapshot.diagnostics.degraded,
              durationMs: completedSpan?.durationMs,
            },
          });
          observability?.metrics.counter(metricNames.connectorFetchTotal, 1, {
            community: account.community,
            outcome: snapshot.diagnostics.degraded || snapshot.warnings.length > 0 ? 'partial' : 'success',
          });
          if (completedSpan) {
            observability?.metrics.timing(metricNames.connectorFetchDurationMs, completedSpan.durationMs, {
              community: account.community,
              outcome: snapshot.diagnostics.degraded || snapshot.warnings.length > 0 ? 'partial' : 'success',
            });
          }

          return {
            status: 'success' as const,
            success: {
              account,
              snapshot,
            },
          };
        } catch (error) {
          const failedSpan = accountSpan?.finish('failure');
          const failure = failureFromError(account, error);
          observability?.logger.event(observabilityEvents.connectorFetchFailed, {
            level: 'error',
            message: 'Connector snapshot fetch failed.',
            errorCode: normalizeErrorCode({ error, warningCode: failure.code }),
            context: {
              community: account.community,
              accountHash: hashIdentifier(`${account.community}:${account.handle}`),
              failureCode: failure.code,
              durationMs: failedSpan?.durationMs,
            },
          });
          observability?.metrics.counter(metricNames.connectorFetchTotal, 1, {
            community: account.community,
            outcome: 'failure',
          });
          if (failedSpan) {
            observability?.metrics.timing(metricNames.connectorFetchDurationMs, failedSpan.durationMs, {
              community: account.community,
              outcome: 'failure',
            });
          }

          return {
            status: 'failed' as const,
            failure,
          };
        }
      },
    );

    const successfulSnapshots = settled
      .filter((entry): entry is { status: 'success'; success: SuccessfulClusterSnapshot } => entry.status === 'success')
      .map((entry) => entry.success);
    const failedAccounts = settled
      .filter((entry): entry is { status: 'failed'; failure: ClusterAccountFetchFailure } => entry.status === 'failed')
      .map((entry) => entry.failure);

    const result = {
      identityCluster: input.identityCluster,
      successfulSnapshots,
      failedAccounts,
      totalAccounts: dedupedAccounts.length,
      successfulCount: successfulSnapshots.length,
      failedCount: failedAccounts.length,
      degraded:
        failedAccounts.length > 0 ||
        successfulSnapshots.some(
          (entry) => entry.snapshot.diagnostics.degraded || entry.snapshot.warnings.length > 0,
        ),
    };

    const completedSpan = span?.finish(
      result.successfulCount === 0 ? 'failure' : result.failedCount > 0 || result.degraded ? 'partial' : 'success',
    );

    observability?.metrics.gauge(metricNames.clusterAccountsRequested, result.totalAccounts, {
      outcome: result.successfulCount === 0 ? 'failure' : result.failedCount > 0 ? 'partial' : 'success',
    });
    observability?.metrics.gauge(metricNames.clusterAccountsSuccessful, result.successfulCount, {
      outcome: result.successfulCount === 0 ? 'failure' : result.failedCount > 0 ? 'partial' : 'success',
    });
    observability?.metrics.gauge(metricNames.clusterAccountsFailed, result.failedCount, {
      outcome: result.successfulCount === 0 ? 'failure' : result.failedCount > 0 ? 'partial' : 'success',
    });

    if (result.successfulCount === 0) {
      observability?.logger.event(observabilityEvents.clusterAnalysisAllFailed, {
        level: 'error',
        message: 'All connector fetches failed for the requested cluster.',
        errorCode: normalizeErrorCode({ allFailed: true }),
        context: {
          totalAccounts: result.totalAccounts,
          failedCount: result.failedCount,
          durationMs: completedSpan?.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.clusterAllFailedTotal, 1, {
        outcome: 'failure',
      });
    } else if (result.failedCount > 0) {
      observability?.logger.event(observabilityEvents.clusterAnalysisPartialSuccess, {
        level: 'warn',
        message: 'Cluster fetch completed with partial success.',
        errorCode: normalizeErrorCode({ partialSuccess: true }),
        context: {
          totalAccounts: result.totalAccounts,
          successfulCount: result.successfulCount,
          failedCount: result.failedCount,
          degraded: result.degraded,
          durationMs: completedSpan?.durationMs,
        },
      });
      observability?.metrics.counter(metricNames.clusterPartialSuccessTotal, 1, {
        outcome: 'partial',
      });
    }

    return result;
  }
}
