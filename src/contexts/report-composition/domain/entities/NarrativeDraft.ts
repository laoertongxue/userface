import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import type { NarrativeAudience } from '@/src/contexts/report-composition/domain/value-objects/NarrativeAudience';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import type { NarrativeTone } from '@/src/contexts/report-composition/domain/value-objects/NarrativeTone';

export const narrativeGeneratedByValues = ['RULE_ONLY', 'LLM_ASSISTED', 'NONE'] as const;

export type NarrativeGeneratedBy = (typeof narrativeGeneratedByValues)[number];

export type NarrativeDraft = {
  mode: NarrativeMode;
  sections: NarrativeSection[];
  generatedBy: NarrativeGeneratedBy;
  audience: NarrativeAudience;
  tone: NarrativeTone;
  warnings?: string[];
  metadata?: {
    provider?: string;
    sectionCount?: number;
  };
};

