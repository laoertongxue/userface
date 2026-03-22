import type { NarrativeAudience } from '@/src/contexts/report-composition/domain/value-objects/NarrativeAudience';
import type { NarrativeMode } from '@/src/contexts/report-composition/domain/value-objects/NarrativeMode';
import type { NarrativeTone } from '@/src/contexts/report-composition/domain/value-objects/NarrativeTone';

export type NarrativePromptMessage = {
  role: 'system' | 'user';
  content: string;
};

export type SerializedNarrativeEvidence = {
  id: string;
  label: string;
  excerpt: string;
  community: string;
  publishedAt: string;
};

export type SerializedNarrativeFacts = {
  scope: {
    isCluster: boolean;
    accountCount: number;
    activeCommunities: string[];
    accountCoverage?: {
      requestedCount: number;
      successfulCount: number;
      failedCount: number;
    };
  };
  portrait: {
    archetype: string;
    tags: string[];
    confidence: number;
    summaryFallback: string;
  };
  traits: {
    stableTraits: Array<{
      code: string;
      displayName: string;
      confidence: number;
      sourceCommunities: string[];
    }>;
    communitySpecificTraits: Record<
      string,
      Array<{
        code: string;
        displayName: string;
        strength?: number;
        rationale: string;
      }>
    >;
    overlap: Array<{
      code: string;
      communities: string[];
      rationale: string;
    }>;
    divergence: Array<{
      code: string;
      dominantCommunity?: string;
      comparedCommunities?: string[];
      rationale: string;
    }>;
  };
  evidence: SerializedNarrativeEvidence[];
  quality: {
    degraded: boolean;
    lowData: boolean;
    warnings: Array<{
      code: string;
      message: string;
    }>;
  };
  narrative: {
    mode: NarrativeMode;
    tone: NarrativeTone;
    audience: NarrativeAudience;
    requiresCaveats: boolean;
  };
};

export type NarrativePromptPayload = {
  messages: NarrativePromptMessage[];
  facts: SerializedNarrativeFacts;
  requiresCaveats: boolean;
};

