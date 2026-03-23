export const governanceModeValues = ['OFF', 'BASELINE', 'STRICT'] as const;

export type GovernanceMode = (typeof governanceModeValues)[number];
