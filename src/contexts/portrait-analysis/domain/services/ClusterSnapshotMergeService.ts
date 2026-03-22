import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { ClusterMergeResult } from '@/src/contexts/portrait-analysis/application/dto/ClusterMergeResult';
import type {
  CommunityId,
  ConnectorWarning,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type {
  ClusterAccountFetchFailure,
  FetchIdentityClusterSnapshotsResult,
} from '@/src/contexts/source-acquisition/application/use-cases/FetchIdentityClusterSnapshots';

function accountKey(account: ClusterAccountRef): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

function dedupeWarnings(warnings: ConnectorWarning[]): ConnectorWarning[] {
  const seen = new Set<string>();

  return warnings
    .filter((warning) => {
      const key = `${warning.code}:${warning.message}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`),
    );
}

function toFailureWarning(failure: ClusterAccountFetchFailure): ConnectorWarning {
  return {
    code: failure.code,
    message: failure.message,
  };
}

export class ClusterSnapshotMergeService {
  merge(input: FetchIdentityClusterSnapshotsResult): ClusterMergeResult {
    const perAccountProfiles = input.identityCluster.accounts
      .map((account) => {
        const successfulEntry = input.successfulSnapshots.find(
          (entry) => accountKey(entry.account) === accountKey(account),
        );

        return {
          account,
          profile: successfulEntry?.snapshot.profile ?? null,
        };
      })
      .sort((left, right) => accountKey(left.account).localeCompare(accountKey(right.account)));

    const perAccountWarnings = input.identityCluster.accounts
      .map((account) => {
        const successfulEntry = input.successfulSnapshots.find(
          (entry) => accountKey(entry.account) === accountKey(account),
        );
        const failedEntry = input.failedAccounts.find(
          (entry) => accountKey(entry.account) === accountKey(account),
        );

        if (successfulEntry) {
          return {
            account,
            warnings: successfulEntry.snapshot.warnings,
            degraded: successfulEntry.snapshot.diagnostics.degraded,
            successful: true,
          };
        }

        return {
          account,
          warnings: failedEntry ? [toFailureWarning(failedEntry)] : [],
          degraded: true,
          successful: false,
        };
      })
      .sort((left, right) => accountKey(left.account).localeCompare(accountKey(right.account)));

    const mergedActivities = input.successfulSnapshots.flatMap((entry) => entry.snapshot.activities);
    const clusterWarnings = dedupeWarnings([
      ...input.successfulSnapshots.flatMap((entry) => entry.snapshot.warnings),
      ...input.failedAccounts.map(toFailureWarning),
    ]);
    const activeCommunities = [
      ...new Set(
        (mergedActivities.length > 0
          ? mergedActivities.map((activity) => activity.community)
          : input.successfulSnapshots.map((entry) => entry.account.community)) as CommunityId[],
      ),
    ].sort();

    return {
      mergedActivities,
      perAccountProfiles,
      perAccountWarnings,
      clusterWarnings,
      degraded:
        input.degraded ||
        input.failedCount > 0 ||
        input.successfulSnapshots.some((entry) => entry.snapshot.diagnostics.degraded),
      successfulAccountCount: input.successfulCount,
      failedAccountCount: input.failedCount,
      activeCommunities,
    };
  }
}
