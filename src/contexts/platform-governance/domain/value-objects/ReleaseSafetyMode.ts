export const releaseSafetyModeValues = ['NORMAL', 'DEGRADED', 'INCIDENT'] as const;

export type ReleaseSafetyMode = (typeof releaseSafetyModeValues)[number];
