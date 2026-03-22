import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { SuggestIdentityLinksInput } from '@/src/contexts/identity-resolution/application/dto/SuggestIdentityLinksInput';
import type {
  SuggestIdentityLinksResult,
  SuggestIdentityLinksWarning,
} from '@/src/contexts/identity-resolution/application/dto/SuggestIdentityLinksResult';
import type { SuggestionCandidateProfile } from '@/src/contexts/identity-resolution/application/dto/SuggestionCandidateProfile';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import type { AcquisitionContext } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import { IdentitySuggestionService } from '@/src/contexts/identity-resolution/domain/services/IdentitySuggestionService';

function accountKey(account: ClusterAccountRef): string {
  return `${account.community}:${account.handle.trim().toLowerCase()}`;
}

function normalizeAccount(account: ClusterAccountRef): ClusterAccountRef {
  return {
    ...account,
    handle: account.handle.trim(),
    displayName: account.displayName?.trim() || undefined,
    homepageUrl: account.homepageUrl?.trim() || undefined,
  };
}

function dedupeAccounts(accounts: ClusterAccountRef[]): ClusterAccountRef[] {
  const seen = new Set<string>();

  return accounts
    .map(normalizeAccount)
    .filter((account) => {
      const key = accountKey(account);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function dedupeWarnings(warnings: SuggestIdentityLinksWarning[]): SuggestIdentityLinksWarning[] {
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

function toSuggestionCandidate(
  account: ClusterAccountRef,
  fetchedProfile: {
    displayName?: string;
    homepageUrl?: string;
    bio?: string;
    avatarUrl?: string;
  } | null,
  warningCodes: string[],
): SuggestionCandidateProfile {
  return {
    account,
    displayName: account.displayName ?? fetchedProfile?.displayName,
    homepageUrl: account.homepageUrl ?? fetchedProfile?.homepageUrl,
    bio: fetchedProfile?.bio,
    avatarUrl: fetchedProfile?.avatarUrl,
    uid: account.uid,
    profileAvailable: Boolean(fetchedProfile),
    warningCodes,
  };
}

type ProfileHintFetchResult = {
  candidate: SuggestionCandidateProfile;
  warnings: SuggestIdentityLinksWarning[];
};

export class SuggestIdentityLinks {
  constructor(
    private readonly connectorRegistry: ConnectorRegistry,
    private readonly suggestionService: IdentitySuggestionService = new IdentitySuggestionService(),
  ) {}

  private async fetchProfileHints(
    account: ClusterAccountRef,
    ctx: AcquisitionContext,
  ): Promise<ProfileHintFetchResult> {
    try {
      const snapshot = await this.connectorRegistry.get(account.community).fetchSnapshot(
        {
          ref: account,
          window: {
            maxItems: 1,
            maxPages: 1,
          },
          include: ['profile'],
        },
        ctx,
      );

      return {
        candidate: toSuggestionCandidate(
          account,
          snapshot.profile
            ? {
                displayName: snapshot.profile.displayName,
                homepageUrl: snapshot.profile.homepageUrl,
                bio: snapshot.profile.bio,
                avatarUrl: snapshot.profile.avatarUrl,
              }
            : null,
          snapshot.warnings.map((warning) => warning.code),
        ),
        warnings: snapshot.warnings.length > 0
          ? [
              {
                code: 'PARTIAL_PROFILE_HINTS',
                message: `Profile hints for ${account.community}:${account.handle} were partially available.`,
              },
            ]
          : [],
      };
    } catch {
      return {
        candidate: toSuggestionCandidate(account, null, ['PROFILE_FETCH_FAILED']),
        warnings: [
          {
            code: 'PARTIAL_PROFILE_HINTS',
            message: `Profile hints for ${account.community}:${account.handle} could not be fetched.`,
          },
        ],
      };
    }
  }

  async execute(
    input: SuggestIdentityLinksInput,
    ctx: AcquisitionContext,
  ): Promise<SuggestIdentityLinksResult> {
    const inspectedAccounts = dedupeAccounts(input.accounts);
    const profileResults = await Promise.all(
      inspectedAccounts.map((account) => this.fetchProfileHints(account, ctx)),
    );
    const warnings = dedupeWarnings(profileResults.flatMap((result) => result.warnings));
    const candidates = profileResults.map((result) => result.candidate);

    const ruleResult = this.suggestionService.suggest({
      candidates,
      includeWeakSignals: input.includeWeakSignals,
      maxSuggestions: input.maxSuggestions,
    });

    const finalWarnings =
      candidates.every((candidate) => !candidate.profileAvailable)
        ? dedupeWarnings([
            ...warnings,
            {
              code: 'NO_PROFILE_HINTS_AVAILABLE',
              message: 'No profile hints could be fetched for the inspected accounts.',
            },
          ])
        : warnings;

    return {
      suggestions: ruleResult.suggestions,
      inspectedAccounts,
      ignoredPairs: ruleResult.ignoredPairs,
      warnings: finalWarnings,
    };
  }
}
