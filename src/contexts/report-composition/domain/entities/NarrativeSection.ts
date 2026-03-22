import type { NarrativeSectionCode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeSectionCode';

export type NarrativeSection = {
  code: NarrativeSectionCode;
  content: string;
  grounded: boolean;
  sourceHints?: string[];
  supportingEvidenceIds?: string[];
};

