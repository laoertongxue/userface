export const NARRATIVE_GATEWAY_POLICY = {
  defaultProvider: 'none',
  defaultTimeoutMs: 4000,
  temporaryTransportSystemInstruction:
    'You must generate grounded narrative JSON strictly from the provided facts. Do not invent new facts, tags, archetypes, communities, confidence claims, or warnings. Return JSON only.',
  temporaryTransportNotice:
    'Temporary transport serializer only. Stage 5 Step 3 will replace this with a formal PromptBuilder.',
} as const;

