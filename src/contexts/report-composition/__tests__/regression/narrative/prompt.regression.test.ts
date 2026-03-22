import { describe, expect, test } from 'vitest';
import { NarrativePromptBuilder } from '@/src/contexts/report-composition/domain/services/NarrativePromptBuilder';
import { NarrativeInputSerializer } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeInputSerializer';
import { makeEvidenceCandidate } from '@/src/contexts/portrait-analysis/__tests__/ruleTestHelpers';
import { narrativeGoldenCases } from '@/src/contexts/report-composition/__tests__/regression/narrative/goldenCases';
import { makeComposeNarrativeInput } from '@/src/contexts/report-composition/__tests__/narrativeGatewayTestHelpers';

describe('Stage 5 narrative prompt regression', () => {
  test('serializes the same single-account facts block deterministically and keeps it compact', () => {
    const serializer = new NarrativeInputSerializer();
    const longEvidence = Array.from({ length: 7 }, (_, index) =>
      makeEvidenceCandidate({
        id: `e-${index + 1}`,
        activityId: `a-${index + 1}`,
        excerpt: `Evidence ${index + 1} ` + 'very long '.repeat(40),
      }),
    );
    const input = makeComposeNarrativeInput({
      ...narrativeGoldenCases.ruleOnlySingleAccount.narrativeInput,
      selectedEvidence: longEvidence,
    });

    const factsA = serializer.serialize(input);
    const factsB = serializer.serialize(input);

    expect(factsA).toEqual(factsB);
    expect(factsA.scope.isCluster).toBe(false);
    expect(factsA.evidence).toHaveLength(5);
    expect(factsA.evidence.every((item) => item.excerpt.length <= 200)).toBe(true);

    const serialized = JSON.stringify(factsA);
    expect(serialized).not.toContain('firstActivityAt');
    expect(serialized).not.toContain('metadata');
  });

  test('locks grounded-only and conservative guardrails for low-data and degraded inputs', () => {
    const builder = new NarrativePromptBuilder();
    const lowDataPayload = builder.build(narrativeGoldenCases.lowData.narrativeInput!);
    const degradedPayload = builder.build(narrativeGoldenCases.degradedSource.narrativeInput!);

    expect(lowDataPayload.messages[0]?.content).toContain('strict JSON');
    expect(lowDataPayload.messages[0]?.content).toContain('Do not invent facts');
    expect(lowDataPayload.messages[0]?.content).toContain('conservative');
    expect(lowDataPayload.messages[1]?.content).toContain('"requiresCaveats":true');

    expect(degradedPayload.messages[1]?.content).toContain('"requiresCaveats":true');
    expect(degradedPayload.messages[1]?.content).toContain('"warnings"');
  });

  test('keeps single-account and multi-community prompt facts distinct', () => {
    const builder = new NarrativePromptBuilder();
    const singlePayload = builder.build(narrativeGoldenCases.llmAssistedSingleAccount.narrativeInput!);
    const multiPayload = builder.build(narrativeGoldenCases.multiCommunity.narrativeInput!);

    expect(singlePayload.facts.scope.isCluster).toBe(false);
    expect(singlePayload.facts.traits.overlap).toEqual([]);
    expect(singlePayload.facts.traits.divergence).toEqual([]);

    expect(multiPayload.facts.scope.isCluster).toBe(true);
    expect(multiPayload.facts.scope.activeCommunities).toEqual(['guozaoke', 'v2ex']);
    expect(Object.keys(multiPayload.facts.traits.communitySpecificTraits)).toEqual([
      'guozaoke',
      'v2ex',
    ]);
    expect(multiPayload.facts.traits.overlap).toHaveLength(1);
    expect(multiPayload.facts.traits.divergence).toHaveLength(1);
  });
});
