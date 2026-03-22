import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import type { ClusterMergeResult } from '@/src/contexts/portrait-analysis/application/dto/ClusterMergeResult';
import type { RuleEvaluationResult } from '@/src/contexts/portrait-analysis/application/dto/RuleEvaluationResult';
import { ArchetypeClassificationService } from '@/src/contexts/portrait-analysis/domain/services/ArchetypeClassificationService';
import { buildFeatureExtractionInput } from '@/src/contexts/portrait-analysis/application/dto/FeatureExtractionInput';
import {
  BaselinePortraitEngine,
  type BaselinePortraitAnalysis,
} from '@/src/contexts/portrait-analysis/domain/services/BaselinePortraitEngine';
import { ActivityDeduplicationService } from '@/src/contexts/portrait-analysis/domain/services/ActivityDeduplicationService';
import { ClusterSnapshotMergeService } from '@/src/contexts/portrait-analysis/domain/services/ClusterSnapshotMergeService';
import { ConfidenceScoringService } from '@/src/contexts/portrait-analysis/domain/services/ConfidenceScoringService';
import { CrossCommunitySynthesisService } from '@/src/contexts/portrait-analysis/domain/services/CrossCommunitySynthesisService';
import { EvidenceSelectionService } from '@/src/contexts/portrait-analysis/domain/services/EvidenceSelectionService';
import { FeatureExtractionService } from '@/src/contexts/portrait-analysis/domain/services/FeatureExtractionService';
import { SignalDerivationService } from '@/src/contexts/portrait-analysis/domain/services/SignalDerivationService';
import { TagCompositionService } from '@/src/contexts/portrait-analysis/domain/services/TagCompositionService';

export class AnalyzeIdentityCluster {
  private readonly activityDeduplicationService: ActivityDeduplicationService;
  private readonly archetypeClassificationService: ArchetypeClassificationService;
  private readonly clusterSnapshotMergeService: ClusterSnapshotMergeService;
  private readonly confidenceScoringService: ConfidenceScoringService;
  private readonly crossCommunitySynthesisService: CrossCommunitySynthesisService;
  private readonly evidenceSelectionService: EvidenceSelectionService;
  private readonly featureExtractionService: FeatureExtractionService;
  private readonly engine: BaselinePortraitEngine;
  private readonly signalDerivationService: SignalDerivationService;
  private readonly tagCompositionService: TagCompositionService;

  constructor(
    clusterSnapshotMergeService: ClusterSnapshotMergeService = new ClusterSnapshotMergeService(),
    activityDeduplicationService: ActivityDeduplicationService = new ActivityDeduplicationService(),
    featureExtractionService: FeatureExtractionService = new FeatureExtractionService(),
    evidenceSelectionService: EvidenceSelectionService = new EvidenceSelectionService(),
    confidenceScoringService: ConfidenceScoringService = new ConfidenceScoringService(),
    signalDerivationService: SignalDerivationService = new SignalDerivationService(),
    tagCompositionService: TagCompositionService = new TagCompositionService(),
    archetypeClassificationService: ArchetypeClassificationService = new ArchetypeClassificationService(),
    crossCommunitySynthesisService: CrossCommunitySynthesisService = new CrossCommunitySynthesisService(),
    engine: BaselinePortraitEngine = new BaselinePortraitEngine(),
  ) {
    this.activityDeduplicationService = activityDeduplicationService;
    this.archetypeClassificationService = archetypeClassificationService;
    this.clusterSnapshotMergeService = clusterSnapshotMergeService;
    this.confidenceScoringService = confidenceScoringService;
    this.crossCommunitySynthesisService = crossCommunitySynthesisService;
    this.evidenceSelectionService = evidenceSelectionService;
    this.featureExtractionService = featureExtractionService;
    this.engine = engine;
    this.signalDerivationService = signalDerivationService;
    this.tagCompositionService = tagCompositionService;
  }

  private buildClusterMergeResult(input: AnalyzePortraitInput): ClusterMergeResult {
    if (input.clusterMergeResult) {
      return input.clusterMergeResult;
    }

    return this.clusterSnapshotMergeService.merge(
      input.fetchResult ?? {
        identityCluster: input.identityCluster,
        successfulSnapshots: input.snapshots.map((snapshot) => ({
          account: {
            ...snapshot.ref,
          },
          snapshot,
        })),
        failedAccounts: [],
        totalAccounts: input.identityCluster.accounts.length,
        successfulCount: input.snapshots.length,
        failedCount: 0,
        degraded: input.snapshots.some(
          (snapshot) => snapshot.diagnostics.degraded || snapshot.warnings.length > 0,
        ),
      },
    );
  }

  execute(input: AnalyzePortraitInput): BaselinePortraitAnalysis {
    const clusterMergeResult = this.buildClusterMergeResult(input);
    const deduplicationResult = this.activityDeduplicationService.dedupe(
      clusterMergeResult.mergedActivities,
    );
    const activityStream = input.activityStream ?? {
      activities: deduplicationResult.dedupedActivities,
    };
    const normalizedInput: AnalyzePortraitInput = {
      ...input,
      activityStream,
      clusterMergeResult,
    };
    const featureVector = this.featureExtractionService.extract(
      buildFeatureExtractionInput(normalizedInput),
    );
    const evidenceSelection = this.evidenceSelectionService.select({
      activities: activityStream.activities,
      featureVector,
    });
    const confidenceProfile = this.confidenceScoringService.score({
      featureVector,
      evidenceSelection,
    });
    const signals = this.signalDerivationService.derive({
      featureVector,
      confidenceProfile,
      selectedEvidence: evidenceSelection.selected,
    });
    const tags = this.tagCompositionService.compose({
      signals,
      confidenceProfile,
    });
    const primaryArchetype = this.archetypeClassificationService.classify({
      featureVector,
      signals,
      tags,
      confidenceProfile,
    });
    const communitySynthesis = this.crossCommunitySynthesisService.synthesize({
      featureVector,
      signals,
      tags,
      selectedEvidence: evidenceSelection.selected,
      confidenceProfile,
    });
    const ruleEvaluation: RuleEvaluationResult = {
      primaryArchetype,
      signals,
      tags,
      stableTraits: communitySynthesis.stableTraits,
      communityInsights: communitySynthesis.communityInsights,
    };

    return this.engine.execute({
      portraitInput: normalizedInput,
      featureVector,
      evidenceSelection,
      confidenceProfile,
      ruleEvaluation,
    });
  }
}
