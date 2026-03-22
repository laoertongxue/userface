import type { NarrativeSectionCode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeSectionCode';

export type NarrativeStructuredSection = {
  code: NarrativeSectionCode;
  content: string;
  sourceHints?: string[];
  supportingEvidenceIds?: string[];
};

export type NarrativeStructuredOutput = {
  sections: NarrativeStructuredSection[];
};

