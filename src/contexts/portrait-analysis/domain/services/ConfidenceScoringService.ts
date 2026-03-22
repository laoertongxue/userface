import type { ConfidenceProfile } from '@/src/contexts/portrait-analysis/application/dto/ConfidenceProfile';
import type { EvidenceSelectionResult } from '@/src/contexts/portrait-analysis/application/dto/EvidenceSelectionResult';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import {
  CONFIDENCE_WEIGHTS,
  CROSS_COMMUNITY_STRONGER_BASIS_BONUS,
  DEGRADED_PENALTY,
  LOW_EVIDENCE_COVERAGE_PENALTY,
  LOW_TEXT_DENSITY_PENALTY,
  MIN_ACTIVITIES_FOR_MEDIUM_CONFIDENCE,
  MIN_ACTIVE_DAYS_FOR_MEDIUM_CONFIDENCE,
  MIN_EVIDENCE_FOR_STRONG_BASIS,
} from '@/src/contexts/portrait-analysis/domain/services/ConfidenceScoringPolicy';
import type { ConfidenceFlag } from '@/src/contexts/portrait-analysis/domain/value-objects/ConfidenceFlag';

type ConfidenceScoringInput = {
  featureVector: FeatureVector;
  evidenceSelection: EvidenceSelectionResult;
};

function clamp01(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

export class ConfidenceScoringService {
  score(input: ConfidenceScoringInput): ConfidenceProfile {
    const { featureVector, evidenceSelection } = input;

    const dataVolume = clamp01(
      featureVector.activity.totalActivities / (MIN_ACTIVITIES_FOR_MEDIUM_CONFIDENCE * 2),
    );
    const activitySpan = clamp01(
      featureVector.activity.activeDays / (MIN_ACTIVE_DAYS_FOR_MEDIUM_CONFIDENCE * 2) * 0.7 +
        Math.min(featureVector.activity.activeSpanDays / 14, 1) * 0.3,
    );
    const textQuality = clamp01(
      featureVector.content.substantiveTextRatio * 0.65 +
        Math.min(
          featureVector.content.avgTextLength / 200,
          1,
        ) *
          0.2 +
        featureVector.content.nonEmptyContentRatio * 0.15,
    );
    const sourceQuality = clamp01(featureVector.dataQuality.degraded ? 0.55 : 0.95);
    const selectedCountScore = clamp01(
      evidenceSelection.stats.selectedCount / MIN_EVIDENCE_FOR_STRONG_BASIS,
    );
    const typeAvailabilityCount = new Set(
      evidenceSelection.candidates.map((candidate) => candidate.activityType).filter(Boolean),
    ).size;
    const balancedTypeCoverage =
      typeAvailabilityCount >= 2
        ? evidenceSelection.stats.topicEvidenceCount > 0 &&
          evidenceSelection.stats.replyEvidenceCount > 0
          ? 1
          : 0.4
        : evidenceSelection.stats.selectedCount > 0
          ? 0.8
          : 0;
    const communityCoverageRatio = clamp01(
      featureVector.activity.activeCommunityCount === 0
        ? 0
        : evidenceSelection.stats.communityCoverage.length /
            featureVector.activity.activeCommunityCount,
    );
    const coverage = clamp01(
      selectedCountScore * 0.45 + balancedTypeCoverage * 0.3 + communityCoverageRatio * 0.25,
    );
    const flags = new Set<ConfidenceFlag>(featureVector.dataQuality.qualityFlags);

    if (evidenceSelection.stats.selectedCount < MIN_EVIDENCE_FOR_STRONG_BASIS) {
      flags.add('LOW_EVIDENCE_COVERAGE');
    }

    if (
      featureVector.community.crossCommunity &&
      evidenceSelection.stats.communityCoverage.length >= 2 &&
      evidenceSelection.stats.selectedCount >= MIN_EVIDENCE_FOR_STRONG_BASIS
    ) {
      flags.add('CROSS_COMMUNITY_STRONGER_BASIS');
    }

    let overall =
      dataVolume * CONFIDENCE_WEIGHTS.dataVolume +
      activitySpan * CONFIDENCE_WEIGHTS.activitySpan +
      textQuality * CONFIDENCE_WEIGHTS.textQuality +
      sourceQuality * CONFIDENCE_WEIGHTS.sourceQuality +
      coverage * CONFIDENCE_WEIGHTS.coverage;

    if (flags.has('DEGRADED_SOURCE')) {
      overall -= DEGRADED_PENALTY;
    }

    if (flags.has('LOW_TEXT_DENSITY')) {
      overall -= LOW_TEXT_DENSITY_PENALTY;
    }

    if (flags.has('LOW_EVIDENCE_COVERAGE')) {
      overall -= LOW_EVIDENCE_COVERAGE_PENALTY;
    }

    if (flags.has('CROSS_COMMUNITY_STRONGER_BASIS')) {
      overall += CROSS_COMMUNITY_STRONGER_BASIS_BONUS;
    }

    const reasons: string[] = [];

    if (dataVolume >= 0.6) {
      reasons.push('adequate-data-volume');
    } else {
      reasons.push('limited-data-volume');
    }

    if (activitySpan >= 0.5) {
      reasons.push('sustained-activity-window');
    } else {
      reasons.push('narrow-activity-window');
    }

    if (textQuality >= 0.6) {
      reasons.push('strong-text-quality');
    } else {
      reasons.push('weak-text-quality');
    }

    if (sourceQuality >= 0.8) {
      reasons.push('stable-source-quality');
    } else {
      reasons.push('degraded-source-quality');
    }

    if (coverage >= 0.6) {
      reasons.push('evidence-coverage-adequate');
    } else {
      reasons.push('evidence-coverage-limited');
    }

    return {
      overall: clamp01(overall),
      dataVolume,
      activitySpan,
      textQuality,
      sourceQuality,
      coverage,
      flags: [...flags],
      reasons,
    };
  }
}
