import type { ConfidenceFlag } from '@/src/contexts/portrait-analysis/domain/value-objects/ConfidenceFlag';

export type ConfidenceProfile = {
  overall: number;
  dataVolume: number;
  activitySpan: number;
  textQuality: number;
  sourceQuality: number;
  coverage: number;
  flags: ConfidenceFlag[];
  reasons: string[];
};
