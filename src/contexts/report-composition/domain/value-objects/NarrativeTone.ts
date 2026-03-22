export const narrativeToneValues = ['NEUTRAL', 'ANALYTICAL', 'CONCISE'] as const;

export type NarrativeTone = (typeof narrativeToneValues)[number];

