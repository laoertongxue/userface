export const MERGE_SUGGESTION_POLICY = {
  homepageExactMatchWeight: 0.46,
  handleExactMatchWeight: 0.4,
  displayNameExactMatchWeight: 0.18,
  handleSimilarityWeight: 0.16,
  bioOverlapWeight: 0.14,
  avatarExactMatchWeight: 0.08,
  conflictingHomepagePenalty: 0.35,
  sparseProfilePenalty: 0.12,
  handleSimilarityThreshold: 0.82,
  bioTokenOverlapThreshold: 0.4,
  minConfidenceToEmit: 0.55,
  strongSuggestionThreshold: 0.75,
  maxSuggestionsDefault: 10,
} as const;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
