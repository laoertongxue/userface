import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import {
  CLUSTER_REPORT_POLICY,
} from '@/src/contexts/report-composition/domain/services/ClusterReportCompositionPolicy';
import type {
  AccountCoverage,
  AccountCoverageEntry,
  AggregatedTrait,
  ClusterConfidenceSummary,
  ClusterInsights,
  CommunitySpecificTrait,
  OverlapInsight,
  ReportAccountRef,
} from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';

function clamp01(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

function fallbackDisplayCode(code: string): string {
  return code.toLowerCase().replaceAll('_', '-');
}

function accountKey(account: { community: string; handle: string }): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

function toReportAccountRef(account: ClusterAccountRef): ReportAccountRef {
  return {
    community: account.community,
    handle: account.handle,
    uid: account.uid,
    homepageUrl: account.homepageUrl,
    displayName: account.displayName,
  };
}

function dedupeAccounts<T extends ClusterAccountRef>(accounts: T[]): T[] {
  const seen = new Set<string>();

  return accounts.filter((account) => {
    const key = accountKey(account);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function tagDisplayName(input: ComposePortraitReportInput, code: string): string {
  return (
    input.tags.find((tag) => tag.code === code)?.displayName ??
    fallbackDisplayCode(code)
  );
}

function signalScoreMap(input: ComposePortraitReportInput): Map<string, number> {
  return new Map(input.signals.map((signal) => [signal.code, signal.score]));
}

function buildStableTraits(input: ComposePortraitReportInput): AggregatedTrait[] {
  const signalScores = signalScoreMap(input);
  const fallbackCodes = input.tags.map((tag) => tag.code);
  const requestedCodes = [
    ...(input.synthesisResult.stableTraits.length > 0
      ? input.synthesisResult.stableTraits
      : fallbackCodes),
  ].filter((value, index, all) => all.indexOf(value) === index);
  const stableTraitLimit =
    input.confidenceProfile.overall >= CLUSTER_REPORT_POLICY.highConfidenceThreshold &&
    !input.featureVector.dataQuality.degraded &&
    !input.tags.some((tag) => tag.code === 'LOW_DATA')
      ? CLUSTER_REPORT_POLICY.stableTraitsHighConfidenceLimit
      : CLUSTER_REPORT_POLICY.stableTraitsLowConfidenceLimit;

  return requestedCodes
    .map((code) => {
      const tag = input.tags.find((entry) => entry.code === code);
      const sourceCommunities = dedupeStrings(
        input.synthesisResult.communityInsights
          .filter((insight) => insight.dominantTraits.includes(code))
          .map((insight) => insight.community),
      );
      const supportingSignals = tag?.supportingSignalCodes ?? [];
      const confidence =
        supportingSignals.length > 0
          ? Math.max(...supportingSignals.map((signalCode) => signalScores.get(signalCode) ?? 0))
          : clamp01(input.confidenceProfile.overall * 0.85);

      return {
        code,
        displayName: tagDisplayName(input, code),
        confidence,
        supportingSignals,
        sourceCommunities:
          sourceCommunities.length > 0
            ? sourceCommunities
            : [...input.featureVector.activity.activeCommunities].sort(),
      };
    })
    .sort((left, right) => {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.code.localeCompare(right.code);
    })
    .slice(0, stableTraitLimit);
}

function buildCommunitySpecificTraits(
  input: ComposePortraitReportInput,
  stableTraits: AggregatedTrait[],
): Record<string, CommunitySpecificTrait[]> {
  const stableTraitSet = new Set(stableTraits.map((trait) => trait.code));
  const singleCommunity =
    input.identityCluster.accounts.length === 1 &&
    input.featureVector.activity.activeCommunityCount <= 1;
  const byCommunity = new Map<string, CommunitySpecificTrait[]>();

  for (const insight of input.synthesisResult.communityInsights) {
    const communityKey = insight.community;
    const specificCodes = insight.dominantTraits.filter((code) =>
      singleCommunity ? true : !stableTraitSet.has(code),
    );
    const candidateCodes =
      specificCodes.length > 0
        ? specificCodes
        : singleCommunity
          ? insight.dominantTraits.slice(0, 2)
          : [];

    const mappedTraits = candidateCodes
      .map((code) => ({
        code,
        displayName: tagDisplayName(input, code),
        rationale: insight.summaryHint,
        strength: insight.confidenceModifier,
      }))
      .slice(0, CLUSTER_REPORT_POLICY.communitySpecificTraitsLimit);

    if (mappedTraits.length === 0) {
      if (!byCommunity.has(communityKey)) {
        byCommunity.set(communityKey, []);
      }

      continue;
    }

    const existing = byCommunity.get(communityKey) ?? [];
    const deduped = [...existing, ...mappedTraits].filter(
      (trait, index, all) => all.findIndex((candidate) => candidate.code === trait.code) === index,
    );

    byCommunity.set(
      communityKey,
      deduped
        .sort((left, right) => {
          if ((right.strength ?? 0) !== (left.strength ?? 0)) {
            return (right.strength ?? 0) - (left.strength ?? 0);
          }

          return left.code.localeCompare(right.code);
        })
        .slice(0, CLUSTER_REPORT_POLICY.communitySpecificTraitsLimit),
    );
  }

  return Object.fromEntries(
    [...byCommunity.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function buildOverlap(
  input: ComposePortraitReportInput,
  stableTraits: AggregatedTrait[],
): OverlapInsight[] {
  if (input.featureVector.activity.activeCommunityCount < 2) {
    return [];
  }

  return stableTraits
    .filter((trait) => trait.sourceCommunities.length >= 2)
    .map((trait) => ({
      code: trait.code,
      communities: [...trait.sourceCommunities].sort(),
      rationale: `${trait.displayName} appears across multiple communities in the current cluster.`,
    }))
    .slice(0, CLUSTER_REPORT_POLICY.overlapLimit);
}

function buildDivergence(
  input: ComposePortraitReportInput,
  communitySpecificTraits: Record<string, CommunitySpecificTrait[]>,
): OverlapInsight[] {
  const communities = Object.keys(communitySpecificTraits).sort();

  if (communities.length < 2) {
    return [];
  }

  const divergences: OverlapInsight[] = [];

  for (const community of communities) {
    const dominantTrait = communitySpecificTraits[community]?.find((trait) =>
      communities.every((otherCommunity) => {
        if (otherCommunity === community) {
          return true;
        }

        return !(communitySpecificTraits[otherCommunity] ?? []).some(
          (candidate) => candidate.code === trait.code,
        );
      }),
    );

    if (!dominantTrait) {
      continue;
    }

    divergences.push({
      code: dominantTrait.code,
      communities: [community],
      dominantCommunity: community,
      comparedCommunities: communities.filter((candidate) => candidate !== community),
      rationale: `${dominantTrait.displayName} is more pronounced on ${community}.`,
    });
  }

  return divergences
    .sort((left, right) => {
      const leftKey = `${left.dominantCommunity ?? ''}:${left.code}`;
      const rightKey = `${right.dominantCommunity ?? ''}:${right.code}`;
      return leftKey.localeCompare(rightKey);
    })
    .slice(0, CLUSTER_REPORT_POLICY.divergenceLimit);
}

function buildAccountCoverage(input: ComposePortraitReportInput): AccountCoverage {
  const requestedAccounts = dedupeAccounts(input.identityCluster.accounts);
  const successfulFromFetch =
    input.fetchResult?.successfulSnapshots.map((entry) => entry.account) ?? [];
  const successfulFromMerge =
    input.clusterMergeResult?.perAccountWarnings
      .filter((entry) => entry.successful)
      .map((entry) => entry.account) ?? [];
  const successfulAccounts = dedupeAccounts(
    successfulFromFetch.length > 0 ? successfulFromFetch : successfulFromMerge,
  );
  const failedFromFetch =
    input.fetchResult?.failedAccounts.map((entry) => ({
      account: toReportAccountRef(entry.account),
      reason: entry.message,
    })) ?? [];
  const failedFromMerge =
    input.clusterMergeResult?.perAccountWarnings
      .filter((entry) => !entry.successful)
      .map((entry) => ({
        account: toReportAccountRef(entry.account),
        reason: entry.warnings[0]?.message,
      })) ?? [];
  const failedAccounts = (
    failedFromFetch.length > 0 ? failedFromFetch : failedFromMerge
  ).filter(
    (failure, index, all) =>
      all.findIndex((candidate) => accountKey(candidate.account) === accountKey(failure.account)) ===
      index,
  );

  const successfulKeys = new Set(successfulAccounts.map((account) => accountKey(account)));
  const failedByKey = new Map(
    failedAccounts.map((failure) => [accountKey(failure.account), failure.reason]),
  );
  const warningMeta = new Map(
    (input.clusterMergeResult?.perAccountWarnings ?? []).map((entry) => [
      accountKey(entry.account),
      entry,
    ]),
  );

  const accountStatuses: AccountCoverageEntry[] = requestedAccounts.map((account) => {
    const key = accountKey(account);
    const warningEntry = warningMeta.get(key);
    const failedReason = failedByKey.get(key);
    const status = failedReason
      ? 'FAILED'
      : successfulKeys.has(key) || warningEntry?.successful
        ? 'SUCCESS'
        : 'REQUESTED';

    return {
      account: toReportAccountRef(account),
      status,
      degraded: warningEntry?.degraded ?? false,
      warningCodes: warningEntry?.warnings.map((warning) => warning.code) ?? [],
      reason: failedReason,
    };
  });

  return {
    requestedAccounts: requestedAccounts.map(toReportAccountRef),
    successfulAccounts: successfulAccounts.map(toReportAccountRef),
    failedAccounts,
    successfulCount: successfulAccounts.length,
    failedCount: failedAccounts.length,
    activeCommunities: dedupeStrings(
      input.clusterMergeResult?.activeCommunities ?? input.featureVector.activity.activeCommunities,
    ),
    accountStatuses,
  };
}

function buildClusterConfidence(
  input: ComposePortraitReportInput,
  accountCoverage: AccountCoverage,
): ClusterConfidenceSummary {
  const requestedCount = Math.max(accountCoverage.requestedAccounts.length, 1);
  const successfulCount = accountCoverage.successfulCount;
  const failedCount = accountCoverage.failedCount;
  const coverageRatio = successfulCount / requestedCount;
  const evidenceCoverage = Math.min(input.selectedEvidence.length / 3, 1);
  const activeCommunityCount = input.featureVector.activity.activeCommunityCount;
  const degraded =
    (input.clusterMergeResult?.degraded ?? false) || input.featureVector.dataQuality.degraded;
  const successBonus = Math.min(
    Math.max(successfulCount - 1, 0) *
      CLUSTER_REPORT_POLICY.clusterConfidence.perSuccessfulAccountBonus,
    CLUSTER_REPORT_POLICY.clusterConfidence.maxSuccessfulAccountBonus,
  );
  const communityBonus = Math.min(
    Math.max(activeCommunityCount - 1, 0) *
      CLUSTER_REPORT_POLICY.clusterConfidence.perCommunityBonus,
    CLUSTER_REPORT_POLICY.clusterConfidence.maxCommunityBonus,
  );
  const failedPenalty = Math.min(
    failedCount * CLUSTER_REPORT_POLICY.clusterConfidence.perFailedAccountPenalty,
    CLUSTER_REPORT_POLICY.clusterConfidence.maxFailedAccountPenalty,
  );
  const degradedPenalty = degraded
    ? CLUSTER_REPORT_POLICY.clusterConfidence.degradedPenalty
    : 0;
  const overall = clamp01(
    input.confidenceProfile.overall * CLUSTER_REPORT_POLICY.clusterConfidence.baseWeight +
      coverageRatio * CLUSTER_REPORT_POLICY.clusterConfidence.coverageWeight +
      evidenceCoverage * CLUSTER_REPORT_POLICY.clusterConfidence.evidenceWeight +
      successBonus +
      communityBonus -
      failedPenalty -
      degradedPenalty,
  );
  const flags = dedupeStrings([
    ...input.confidenceProfile.flags,
    ...(failedCount > 0 ? ['PARTIAL_ACCOUNT_FAILURE'] : []),
    ...(degraded ? ['DEGRADED_SOURCE'] : []),
    ...(activeCommunityCount >= 2 && successfulCount >= 2 && coverageRatio === 1
      ? ['CROSS_COMMUNITY_STRONGER_BASIS']
      : []),
  ]);
  const reasons = dedupeStrings([
    requestedCount === 1 ? 'single-account-basis' : 'multi-account-coverage',
    ...(activeCommunityCount >= 2 ? ['cross-community-coverage'] : []),
    ...(evidenceCoverage >= 1 ? ['evidence-coverage'] : []),
    ...(failedCount > 0 ? ['partial-account-failure'] : []),
    ...(degraded ? ['degraded-source'] : []),
  ]);

  return {
    overall,
    reasons,
    flags,
  };
}

export class ClusterReportBuilder {
  build(input: ComposePortraitReportInput): ClusterInsights {
    const stableTraits = buildStableTraits(input);
    const communitySpecificTraits = buildCommunitySpecificTraits(input, stableTraits);
    const accountCoverage = buildAccountCoverage(input);
    const overlap = buildOverlap(input, stableTraits);
    const divergence = buildDivergence(input, communitySpecificTraits);

    return {
      stableTraits,
      communitySpecificTraits,
      overlap,
      divergence,
      confidence: buildClusterConfidence(input, accountCoverage),
      accountCoverage,
    };
  }
}
