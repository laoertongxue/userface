export const narrativeAudienceValues = ['PRODUCT_USER', 'INTERNAL_QA'] as const;

export type NarrativeAudience = (typeof narrativeAudienceValues)[number];

