import { describe, expect, test } from 'vitest';
import { BaselinePortraitEngine } from '@/src/contexts/portrait-analysis/domain/services/BaselinePortraitEngine';
import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import { buildFeatureExtractionInput } from '@/src/contexts/portrait-analysis/application/dto/FeatureExtractionInput';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import { ArchetypeClassificationService } from '@/src/contexts/portrait-analysis/domain/services/ArchetypeClassificationService';
import { ConfidenceScoringService } from '@/src/contexts/portrait-analysis/domain/services/ConfidenceScoringService';
import { CrossCommunitySynthesisService } from '@/src/contexts/portrait-analysis/domain/services/CrossCommunitySynthesisService';
import { EvidenceSelectionService } from '@/src/contexts/portrait-analysis/domain/services/EvidenceSelectionService';
import { FeatureExtractionService } from '@/src/contexts/portrait-analysis/domain/services/FeatureExtractionService';
import { SignalDerivationService } from '@/src/contexts/portrait-analysis/domain/services/SignalDerivationService';
import { TagCompositionService } from '@/src/contexts/portrait-analysis/domain/services/TagCompositionService';

const minimalInput: AnalyzePortraitInput = {
  identityCluster: createIdentityCluster({
    accounts: [
      {
        community: 'v2ex',
        handle: 'sample-user',
      },
    ],
    mode: 'SINGLE_ACCOUNT',
    now: '2026-03-22T00:00:00.000Z',
  }),
  snapshots: [
    {
      ref: {
        community: 'v2ex',
        handle: 'sample-user',
      },
      profile: {
        community: 'v2ex',
        handle: 'sample-user',
        displayName: 'sample-user',
        stats: {},
      },
      activities: [
        {
          id: 'activity-1',
          community: 'v2ex',
          handle: 'sample-user',
          type: 'reply',
          url: 'https://www.v2ex.com/t/1001',
          topicId: '1001',
          topicTitle: 'How to ship a modular monolith',
          nodeName: 'architecture',
          contentText: 'How should I structure a modular monolith for community analytics?',
          excerpt: 'How should I structure a modular monolith for community analytics?',
          publishedAt: '2026-03-22T00:00:00.000Z',
          sourceTrace: {
            route: '/member/:username/replies',
            fetchedAt: '2026-03-22T00:05:00.000Z',
            contentHash: 'hash-1',
          },
        },
        {
          id: 'activity-2',
          community: 'v2ex',
          handle: 'sample-user',
          type: 'topic',
          url: 'https://www.v2ex.com/t/1002',
          topicId: '1002',
          topicTitle: 'Weekly architecture notes',
          nodeName: 'notes',
          contentText: 'Weekly architecture notes with links https://example.com/notes',
          excerpt: 'Weekly architecture notes with links https://example.com/notes',
          publishedAt: '2026-03-21T00:00:00.000Z',
          stats: {
            replyCount: 3,
          },
          sourceTrace: {
            route: '/member/:username/topics',
            fetchedAt: '2026-03-22T00:05:00.000Z',
            contentHash: 'hash-2',
          },
        },
      ],
      diagnostics: {
        fetchedPages: 3,
        fetchedItems: 2,
        elapsedMs: 1200,
        degraded: false,
        usedRoutes: ['/api/members/show.json', '/member/:username/replies', '/member/:username/topics'],
      },
      warnings: [],
    },
  ],
  activityStream: {
    activities: [
      {
        id: 'activity-1',
        community: 'v2ex',
        handle: 'sample-user',
        type: 'reply',
        url: 'https://www.v2ex.com/t/1001',
        topicId: '1001',
        topicTitle: 'How to ship a modular monolith',
        nodeName: 'architecture',
        contentText: 'How should I structure a modular monolith for community analytics?',
        excerpt: 'How should I structure a modular monolith for community analytics?',
        publishedAt: '2026-03-22T00:00:00.000Z',
        sourceTrace: {
          route: '/member/:username/replies',
          fetchedAt: '2026-03-22T00:05:00.000Z',
          contentHash: 'hash-1',
        },
      },
      {
        id: 'activity-2',
        community: 'v2ex',
        handle: 'sample-user',
        type: 'topic',
        url: 'https://www.v2ex.com/t/1002',
        topicId: '1002',
        topicTitle: 'Weekly architecture notes',
        nodeName: 'notes',
        contentText: 'Weekly architecture notes with links https://example.com/notes',
        excerpt: 'Weekly architecture notes with links https://example.com/notes',
        publishedAt: '2026-03-21T00:00:00.000Z',
        stats: {
          replyCount: 3,
        },
        sourceTrace: {
          route: '/member/:username/topics',
          fetchedAt: '2026-03-22T00:05:00.000Z',
          contentHash: 'hash-2',
        },
      },
    ],
  },
};

describe('BaselinePortraitEngine', () => {
  test('returns a stable internal analysis result for report composition', () => {
    const featureVector = new FeatureExtractionService().extract(
      buildFeatureExtractionInput(minimalInput),
    );
    const evidenceSelection = new EvidenceSelectionService().select({
      activities: minimalInput.activityStream!.activities,
      featureVector,
    });
    const confidenceProfile = new ConfidenceScoringService().score({
      featureVector,
      evidenceSelection,
    });
    const signals = new SignalDerivationService().derive({
      featureVector,
      confidenceProfile,
      selectedEvidence: evidenceSelection.selected,
    });
    const tags = new TagCompositionService().compose({
      signals,
      confidenceProfile,
    });
    const primaryArchetype = new ArchetypeClassificationService().classify({
      featureVector,
      signals,
      tags,
      confidenceProfile,
    });
    const communitySynthesis = new CrossCommunitySynthesisService().synthesize({
      featureVector,
      signals,
      tags,
      selectedEvidence: evidenceSelection.selected,
      confidenceProfile,
    });
    const analysis = new BaselinePortraitEngine().analyze({
      portraitInput: minimalInput,
      featureVector,
      evidenceSelection,
      confidenceProfile,
      ruleEvaluation: {
        primaryArchetype,
        signals,
        tags,
        stableTraits: communitySynthesis.stableTraits,
        communityInsights: communitySynthesis.communityInsights,
      },
    });

    expect(analysis.featureVector.activity).toMatchObject({
      totalActivities: 2,
      topicCount: 1,
      replyCount: 1,
      activeCommunities: ['v2ex'],
      activeCommunityCount: 1,
    });
    expect(analysis.featureVector.community.perCommunityMetrics).toMatchObject({
      'v2ex:sample-user': expect.objectContaining({
        totalActivities: 2,
      }),
    });
    expect(analysis.evidenceCandidates).toHaveLength(2);
    expect(analysis.selectedEvidence).toHaveLength(2);
    expect(analysis.confidenceProfile).toMatchObject({
      overall: expect.any(Number),
    });
    expect(analysis.signals.map((signal) => signal.code)).toContain('LOW_DATA');
    expect(analysis.tags.map((tag) => tag.code)).toContain('LOW_DATA');
    expect(analysis.primaryArchetype).toMatchObject({
      code: 'INSUFFICIENT_DATA',
      score: expect.any(Number),
    });
    expect(analysis.synthesisResult.communityInsights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          community: 'v2ex',
          handle: 'sample-user',
        }),
      ]),
    );
    expect(analysis.warnings).toEqual([]);
  });
});
