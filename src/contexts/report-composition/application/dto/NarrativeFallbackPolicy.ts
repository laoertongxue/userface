import type { NarrativeFallbackMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeFallbackMode';

export type NarrativeFallbackPolicy = {
  mode: NarrativeFallbackMode;
  allowRuleSummary: boolean;
  allowEmptyDraft: boolean;
  includeFallbackWarnings: boolean;
};

