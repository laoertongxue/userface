export const NARRATIVE_PROMPT_POLICY = {
  maxEvidenceItems: 5,
  maxEvidenceExcerptChars: 200,
  maxWarningItems: 4,
  requiredSections: ['HEADLINE', 'SHORT_SUMMARY'] as const,
  cautionSectionCode: 'CAVEATS' as const,
  systemInstruction: [
    'You generate grounded narrative JSON from provided structured facts only.',
    'Return strict JSON with a top-level "sections" array.',
    'Do not output markdown code fences.',
    'Do not invent facts, tags, communities, archetypes, evidence ids, or warnings.',
    'Use conservative wording when low-data, degraded, or warnings are present.',
    'Do not infer identity, profession, location, age, income, or personality traits that are not in the facts.',
  ].join(' '),
  taskInstruction: [
    'Generate concise narrative sections using only the supplied facts.',
    'HEADLINE and SHORT_SUMMARY should usually be present.',
    'CAVEATS is mandatory when requiresCaveats is true.',
    'COMMUNITY_SPECIFICS and OVERLAP_DIVERGENCE must only appear when the facts support them.',
    'supportingEvidenceIds must reference only evidence ids from the facts block.',
  ].join(' '),
} as const;

