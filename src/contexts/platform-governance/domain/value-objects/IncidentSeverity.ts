export const incidentSeverityValues = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type IncidentSeverity = (typeof incidentSeverityValues)[number];
