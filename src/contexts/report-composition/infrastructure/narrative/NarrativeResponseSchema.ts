import { z } from 'zod';
import { narrativeSectionCodeValues } from '@/src/contexts/report-composition/domain/value-objects/NarrativeSectionCode';

export const narrativeStructuredSectionSchema = z.object({
  code: z.enum(narrativeSectionCodeValues),
  content: z.string().trim().min(1),
  sourceHints: z.array(z.string()).optional().default([]),
  supportingEvidenceIds: z.array(z.string()).optional().default([]),
});

export const narrativeStructuredOutputSchema = z.object({
  sections: z.array(narrativeStructuredSectionSchema).min(1),
});

