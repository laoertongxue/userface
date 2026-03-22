export const narrativeSectionCodeValues = [
  'HEADLINE',
  'SHORT_SUMMARY',
  'DEEP_SUMMARY',
  'STABLE_TRAITS',
  'COMMUNITY_SPECIFICS',
  'OVERLAP_DIVERGENCE',
  'CAVEATS',
] as const;

export type NarrativeSectionCode = (typeof narrativeSectionCodeValues)[number];

