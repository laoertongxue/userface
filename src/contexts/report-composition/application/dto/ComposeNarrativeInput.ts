import type { NarrativeFallbackPolicy } from '@/src/contexts/report-composition/application/dto/NarrativeFallbackPolicy';
import type { FeatureVector } from '@/src/contexts/portrait-analysis/application/dto/FeatureVector';
import type {
  AccountCoverage,
  AggregatedTrait,
  CommunitySpecificTrait,
  OverlapInsight,
  Portrait,
  PortraitWarning,
} from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import type { NarrativeAudience } from '@/src/contexts/report-composition/domain/value-objects/NarrativeAudience';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import type { NarrativeTone } from '@/src/contexts/report-composition/domain/value-objects/NarrativeTone';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export type ComposeNarrativeInput = {
  portrait: Pick<Portrait, 'archetype' | 'tags' | 'summary' | 'confidence'>;
  featureVector: FeatureVector;
  signals: Signal[];
  stableTraits: AggregatedTrait[];
  communitySpecificTraits: Record<string, CommunitySpecificTrait[]>;
  overlap?: OverlapInsight[];
  divergence?: OverlapInsight[];
  warnings: PortraitWarning[];
  degraded: boolean;
  selectedEvidence: EvidenceCandidate[];
  accountCoverage?: AccountCoverage;
  mode: NarrativeMode;
  tone: NarrativeTone;
  audience: NarrativeAudience;
  fallbackPolicy: NarrativeFallbackPolicy;
  observability?: ObservabilityContext;
};
