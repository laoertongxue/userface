import { describe, expect, test } from 'vitest';
import type { SuggestionCandidateProfile } from '@/src/contexts/identity-resolution/application/dto/SuggestionCandidateProfile';
import { IdentitySuggestionService } from '@/src/contexts/identity-resolution/domain/services/IdentitySuggestionService';

function buildCandidate(overrides: Partial<SuggestionCandidateProfile>): SuggestionCandidateProfile {
  return {
    account: {
      community: 'v2ex',
      handle: 'alpha',
    },
    profileAvailable: true,
    warningCodes: [],
    ...overrides,
  };
}

describe('IdentitySuggestionService', () => {
  test('emits a high-confidence suggestion for exact homepage and normalized handle match', () => {
    const result = new IdentitySuggestionService().suggest({
      candidates: [
        buildCandidate({
          account: { community: 'v2ex', handle: 'Alpha.Dev' },
          homepageUrl: 'https://example.com/about/',
        }),
        buildCandidate({
          account: { community: 'guozaoke', handle: 'alpha_dev' },
          homepageUrl: 'http://www.example.com/about',
        }),
      ],
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.suggestions[0].reasons).toEqual(
      expect.arrayContaining(['homepage-exact-match', 'handle-exact-match']),
    );
  });

  test('ignores same-community pairs instead of emitting a merge suggestion', () => {
    const result = new IdentitySuggestionService().suggest({
      candidates: [
        buildCandidate({
          account: { community: 'v2ex', handle: 'alpha' },
          homepageUrl: 'https://example.com',
        }),
        buildCandidate({
          account: { community: 'v2ex', handle: 'beta' },
          homepageUrl: 'https://example.com',
        }),
      ],
    });

    expect(result.suggestions).toEqual([]);
    expect(result.ignoredPairs).toEqual([
      expect.objectContaining({
        reason: 'same-community-pair',
      }),
    ]);
  });

  test('does not emit when only weak similarity exists', () => {
    const result = new IdentitySuggestionService().suggest({
      candidates: [
        buildCandidate({
          account: { community: 'v2ex', handle: 'alpha-dev' },
          profileAvailable: false,
        }),
        buildCandidate({
          account: { community: 'guozaoke', handle: 'alpha.devx' },
          profileAvailable: false,
        }),
      ],
      includeWeakSignals: true,
    });

    expect(result.suggestions).toEqual([]);
    expect(result.ignoredPairs[0].reason).toMatch(/insufficient-hints|below-confidence-threshold/);
  });

  test('suppresses output when homepage information conflicts', () => {
    const result = new IdentitySuggestionService().suggest({
      candidates: [
        buildCandidate({
          account: { community: 'v2ex', handle: 'alpha' },
          homepageUrl: 'https://alpha.example.com',
        }),
        buildCandidate({
          account: { community: 'guozaoke', handle: 'alpha' },
          homepageUrl: 'https://beta.example.com',
        }),
      ],
    });

    expect(result.suggestions).toEqual([]);
    expect(result.ignoredPairs).toEqual([
      expect.objectContaining({
        reason: 'conflicting-homepage',
      }),
    ]);
  });

  test('keeps sparse profiles conservative even when handles match exactly', () => {
    const result = new IdentitySuggestionService().suggest({
      candidates: [
        buildCandidate({
          account: { community: 'v2ex', handle: 'alpha' },
          profileAvailable: false,
        }),
        buildCandidate({
          account: { community: 'guozaoke', handle: 'alpha' },
          profileAvailable: false,
        }),
      ],
    });

    expect(result.suggestions).toEqual([]);
  });

  test('sorts suggestions by confidence desc and keeps ties stable', () => {
    const result = new IdentitySuggestionService().suggest({
      candidates: [
        buildCandidate({
          account: { community: 'v2ex', handle: 'alpha' },
          displayName: 'Alpha',
          homepageUrl: 'https://example.com/about',
        }),
        buildCandidate({
          account: { community: 'guozaoke', handle: 'alpha' },
          displayName: 'Alpha',
          homepageUrl: 'https://example.com/about/',
        }),
        buildCandidate({
          account: { community: 'weibo', handle: 'alpha' },
          displayName: 'Alpha',
        }),
      ],
    });

    expect(result.suggestions.map((suggestion) => suggestion.confidence)).toEqual([1, 0.58, 0.58]);
    expect(result.suggestions.map((suggestion) => suggestion.candidateAccounts.map((account) => account.community).join('+'))).toEqual([
      'guozaoke+v2ex',
      'guozaoke+weibo',
      'v2ex+weibo',
    ]);
  });
});
