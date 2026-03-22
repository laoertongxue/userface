import type { SuggestionCandidateProfile } from '@/src/contexts/identity-resolution/application/dto/SuggestionCandidateProfile';
import type {
  IgnoredSuggestionPair,
  SuggestIdentityLinksResult,
} from '@/src/contexts/identity-resolution/application/dto/SuggestIdentityLinksResult';
import type { ClusterAccountRef } from '@/src/contexts/identity-resolution/domain/entities/ClusterAccountRef';
import type { MergeSuggestion } from '@/src/contexts/identity-resolution/domain/entities/MergeSuggestion';
import {
  MERGE_SUGGESTION_POLICY,
  clamp01,
} from '@/src/contexts/identity-resolution/domain/services/MergeSuggestionPolicy';
import { normalizeWhitespace } from '@/src/shared/utils/text';

type IdentitySuggestionInput = {
  candidates: SuggestionCandidateProfile[];
  maxSuggestions?: number;
  includeWeakSignals?: boolean;
};

type PairEvaluation =
  | {
      outcome: 'ignored';
      ignored: IgnoredSuggestionPair;
    }
  | {
      outcome: 'suggested';
      suggestion: MergeSuggestion;
    };

function pairKey(left: ClusterAccountRef, right: ClusterAccountRef): string {
  return [left, right]
    .map((account) => `${account.community}:${account.handle.trim().toLowerCase()}`)
    .sort()
    .join('|');
}

function normalizeHandle(value?: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
}

function normalizeDisplayName(value?: string): string {
  return normalizeWhitespace(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeHomepage(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const raw = value.trim();

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
}

function normalizeAvatar(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return value.trim().toLowerCase();
}

function tokenizeBio(value?: string): string[] {
  const matches = normalizeWhitespace(value ?? '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]{2,}/gu);

  return matches ? [...new Set(matches)] : [];
}

function diceCoefficient(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const leftBigrams = new Map<string, number>();

  for (let index = 0; index < left.length - 1; index += 1) {
    const bigram = left.slice(index, index + 2);
    leftBigrams.set(bigram, (leftBigrams.get(bigram) ?? 0) + 1);
  }

  let overlap = 0;

  for (let index = 0; index < right.length - 1; index += 1) {
    const bigram = right.slice(index, index + 2);
    const count = leftBigrams.get(bigram) ?? 0;

    if (count > 0) {
      leftBigrams.set(bigram, count - 1);
      overlap += 1;
    }
  }

  return (2 * overlap) / (left.length + right.length - 2);
}

function tokenOverlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;

  leftSet.forEach((token) => {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(Math.min(leftSet.size, rightSet.size), 1);
}

function buildSourceHint(reasons: string[], confidence: number): string {
  if (reasons.includes('homepage-exact-match') && reasons.includes('handle-exact-match')) {
    return confidence >= MERGE_SUGGESTION_POLICY.strongSuggestionThreshold
      ? 'Strong identity hint from homepage and normalized handle match.'
      : 'Homepage and normalized handle point to the same subject.';
  }

  if (reasons.includes('conflicting-homepage')) {
    return 'Signals are mixed because homepage information conflicts.';
  }

  return `Suggestion is based on ${reasons.join(', ')}.`;
}

function hintDensity(candidate: SuggestionCandidateProfile): number {
  return [
    candidate.displayName,
    candidate.homepageUrl,
    candidate.bio,
    candidate.avatarUrl,
    candidate.uid,
  ].filter(Boolean).length;
}

function sortAccounts(left: ClusterAccountRef, right: ClusterAccountRef): [ClusterAccountRef, ClusterAccountRef] {
  return pairKey(left, right) === `${left.community}:${left.handle.trim().toLowerCase()}|${right.community}:${right.handle.trim().toLowerCase()}`
    ? [left, right]
    : [right, left];
}

function evaluatePair(
  left: SuggestionCandidateProfile,
  right: SuggestionCandidateProfile,
  includeWeakSignals: boolean,
): PairEvaluation {
  const [from, to] = sortAccounts(left.account, right.account);

  if (left.account.community === right.account.community) {
    return {
      outcome: 'ignored',
      ignored: {
        from,
        to,
        reason: 'same-community-pair',
      },
    };
  }

  const reasons: string[] = [];
  let score = 0;
  let conflictingHomepage = false;

  const leftHomepage = normalizeHomepage(left.homepageUrl ?? left.account.homepageUrl);
  const rightHomepage = normalizeHomepage(right.homepageUrl ?? right.account.homepageUrl);

  if (leftHomepage && rightHomepage) {
    if (leftHomepage === rightHomepage) {
      score += MERGE_SUGGESTION_POLICY.homepageExactMatchWeight;
      reasons.push('homepage-exact-match');
    } else {
      score -= MERGE_SUGGESTION_POLICY.conflictingHomepagePenalty;
      reasons.push('conflicting-homepage');
      conflictingHomepage = true;
    }
  }

  const leftHandle = normalizeHandle(left.account.handle);
  const rightHandle = normalizeHandle(right.account.handle);

  if (leftHandle && rightHandle) {
    if (leftHandle === rightHandle) {
      score += MERGE_SUGGESTION_POLICY.handleExactMatchWeight;
      reasons.push('handle-exact-match');
    } else {
      const similarity = diceCoefficient(leftHandle, rightHandle);

      if (
        similarity >= MERGE_SUGGESTION_POLICY.handleSimilarityThreshold &&
        includeWeakSignals
      ) {
        score += MERGE_SUGGESTION_POLICY.handleSimilarityWeight;
        reasons.push('handle-similar');
      }
    }
  }

  const leftDisplayName = normalizeDisplayName(left.displayName);
  const rightDisplayName = normalizeDisplayName(right.displayName);

  if (leftDisplayName && rightDisplayName && leftDisplayName === rightDisplayName) {
    score += MERGE_SUGGESTION_POLICY.displayNameExactMatchWeight;
    reasons.push('display-name-match');
  }

  const bioOverlap = tokenOverlapRatio(tokenizeBio(left.bio), tokenizeBio(right.bio));

  if (
    bioOverlap >= MERGE_SUGGESTION_POLICY.bioTokenOverlapThreshold &&
    includeWeakSignals
  ) {
    score += MERGE_SUGGESTION_POLICY.bioOverlapWeight;
    reasons.push('bio-overlap');
  }

  const leftAvatar = normalizeAvatar(left.avatarUrl);
  const rightAvatar = normalizeAvatar(right.avatarUrl);

  if (leftAvatar && rightAvatar && leftAvatar === rightAvatar) {
    score += MERGE_SUGGESTION_POLICY.avatarExactMatchWeight;
    reasons.push('avatar-match');
  }

  const sparseHints = hintDensity(left) + hintDensity(right) < 3;
  const hasStrongAnchor =
    reasons.includes('homepage-exact-match') || reasons.includes('handle-exact-match');

  if (sparseHints && !hasStrongAnchor) {
    score -= MERGE_SUGGESTION_POLICY.sparseProfilePenalty;
  }

  const confidence = clamp01(score);

  if (confidence < MERGE_SUGGESTION_POLICY.minConfidenceToEmit) {
    return {
      outcome: 'ignored',
      ignored: {
        from,
        to,
        reason: conflictingHomepage
          ? 'conflicting-homepage'
          : sparseHints
            ? 'insufficient-hints'
            : 'below-confidence-threshold',
      },
    };
  }

  return {
    outcome: 'suggested',
    suggestion: {
      candidateAccounts: [from, to],
      confidence,
      reasons,
      status: 'PENDING',
      sourceHint: buildSourceHint(reasons, confidence),
    },
  };
}

export class IdentitySuggestionService {
  suggest(input: IdentitySuggestionInput): Pick<SuggestIdentityLinksResult, 'suggestions' | 'ignoredPairs'> {
    const suggestions: MergeSuggestion[] = [];
    const ignoredPairs: IgnoredSuggestionPair[] = [];

    for (let index = 0; index < input.candidates.length; index += 1) {
      for (let cursor = index + 1; cursor < input.candidates.length; cursor += 1) {
        const evaluation = evaluatePair(
          input.candidates[index],
          input.candidates[cursor],
          input.includeWeakSignals ?? false,
        );

        if (evaluation.outcome === 'suggested') {
          suggestions.push(evaluation.suggestion);
          continue;
        }

        ignoredPairs.push(evaluation.ignored);
      }
    }

    const dedupedSuggestions = suggestions
      .filter((suggestion, index, all) => {
        const key = pairKey(suggestion.candidateAccounts[0], suggestion.candidateAccounts[1]);
        return all.findIndex(
          (candidate) => pairKey(candidate.candidateAccounts[0], candidate.candidateAccounts[1]) === key,
        ) === index;
      })
      .sort((left, right) => {
        if (right.confidence !== left.confidence) {
          return right.confidence - left.confidence;
        }

        return pairKey(left.candidateAccounts[0], left.candidateAccounts[1]).localeCompare(
          pairKey(right.candidateAccounts[0], right.candidateAccounts[1]),
        );
      })
      .slice(0, input.maxSuggestions ?? MERGE_SUGGESTION_POLICY.maxSuggestionsDefault);

    const stableIgnoredPairs = [...ignoredPairs].sort((left, right) => {
      const leftKey = `${pairKey(left.from, left.to)}:${left.reason}`;
      const rightKey = `${pairKey(right.from, right.to)}:${right.reason}`;
      return leftKey.localeCompare(rightKey);
    });

    return {
      suggestions: dedupedSuggestions,
      ignoredPairs: stableIgnoredPairs,
    };
  }
}
