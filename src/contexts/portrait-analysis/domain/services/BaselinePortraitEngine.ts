import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import type { CommunitySynthesisResult } from '@/src/contexts/portrait-analysis/application/dto/CommunitySynthesisResult';
import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { EvidenceSelectionResult } from '@/src/contexts/portrait-analysis/application/dto/EvidenceSelectionResult';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type { RuleEvaluationResult } from '@/src/contexts/portrait-analysis/application/dto/RuleEvaluationResult';
import type { PortraitWarning } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';

export type BaselinePortraitEngineInput = {
  featureVector: FeatureVector;
  portraitInput: AnalyzePortraitInput;
  evidenceSelection: EvidenceSelectionResult;
  confidenceProfile: ConfidenceProfile;
  ruleEvaluation: RuleEvaluationResult;
};

export type BaselinePortraitAnalysis = {
  archetype: ArchetypeCode;
  confidenceProfile: ConfidenceProfile;
  evidenceCandidates: EvidenceCandidate[];
  featureVector: FeatureVector;
  primaryArchetype: RuleEvaluationResult['primaryArchetype'];
  selectedEvidence: EvidenceCandidate[];
  signals: Signal[];
  synthesisResult: CommunitySynthesisResult;
  tags: PortraitTag[];
  warnings: PortraitWarning[];
};

export class BaselinePortraitEngine {
  analyze(input: BaselinePortraitEngineInput): BaselinePortraitAnalysis {
    const warnings = input.portraitInput.snapshots.flatMap((snapshot) => snapshot.warnings);

    return {
      archetype: input.ruleEvaluation.primaryArchetype.code,
      confidenceProfile: input.confidenceProfile,
      evidenceCandidates: input.evidenceSelection.candidates,
      featureVector: input.featureVector,
      primaryArchetype: input.ruleEvaluation.primaryArchetype,
      selectedEvidence: input.evidenceSelection.selected,
      signals: input.ruleEvaluation.signals,
      synthesisResult: {
        stableTraits: input.ruleEvaluation.stableTraits,
        communityInsights: input.ruleEvaluation.communityInsights,
      },
      tags: input.ruleEvaluation.tags,
      warnings,
    };
  }

  execute(input: BaselinePortraitEngineInput): BaselinePortraitAnalysis {
    return this.analyze(input);
  }
}
