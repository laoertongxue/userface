export const healthStatusValues = ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'] as const;

export type HealthStatus = (typeof healthStatusValues)[number];
