export type DegradationPlan = {
  disableNarrative: boolean;
  forceRuleOnlyNarrative: boolean;
  disableSuggest: boolean;
  disableClusterAnalysis: boolean;
  disableAnalyze: boolean;
  reasonCodes: string[];
};

export function createDegradationPlan(input: Partial<DegradationPlan> = {}): DegradationPlan {
  return {
    disableNarrative: input.disableNarrative ?? false,
    forceRuleOnlyNarrative: input.forceRuleOnlyNarrative ?? false,
    disableSuggest: input.disableSuggest ?? false,
    disableClusterAnalysis: input.disableClusterAnalysis ?? false,
    disableAnalyze: input.disableAnalyze ?? false,
    reasonCodes: [...new Set((input.reasonCodes ?? []).map((code) => code.trim()).filter(Boolean))],
  };
}
