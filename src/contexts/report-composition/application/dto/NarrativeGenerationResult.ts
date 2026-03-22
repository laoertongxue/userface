import type { NarrativeDraft } from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import type { NarrativeFallbackMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeFallbackMode';

export type NarrativeGenerationResult = {
  draft: NarrativeDraft | null;
  fallbackUsed: boolean;
  fallbackMode?: NarrativeFallbackMode;
  warnings?: string[];
};

