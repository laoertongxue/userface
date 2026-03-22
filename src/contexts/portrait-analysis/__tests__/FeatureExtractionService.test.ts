import { describe, expect, test } from 'vitest';
import type { CanonicalActivity } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { FeatureExtractionInput } from '@/src/contexts/portrait-analysis/application/dto/FeatureExtractionInput';
import { FeatureExtractionService } from '@/src/contexts/portrait-analysis/domain/services/FeatureExtractionService';

function activity(overrides: Partial<CanonicalActivity>): CanonicalActivity {
  return {
    id: overrides.id ?? 'activity',
    community: overrides.community ?? 'v2ex',
    handle: overrides.handle ?? 'sample-user',
    type: overrides.type ?? 'reply',
    url: overrides.url ?? 'https://example.com/t/1',
    topicTitle: overrides.topicTitle,
    nodeName: overrides.nodeName,
    contentText: overrides.contentText ?? '',
    excerpt: overrides.excerpt ?? '',
    publishedAt: overrides.publishedAt ?? '2026-03-20T00:00:00.000Z',
    sourceTrace: overrides.sourceTrace ?? {
      route: '/route',
      fetchedAt: '2026-03-20T00:00:00.000Z',
      contentHash: 'hash',
    },
    stats: overrides.stats,
    topicId: overrides.topicId,
  };
}

function featureInput(overrides: Partial<FeatureExtractionInput>): FeatureExtractionInput {
  return {
    activities: overrides.activities ?? [],
    communities:
      overrides.communities ?? [
        {
          community: 'v2ex',
          handle: 'sample-user',
          degraded: false,
          warnings: [],
        },
      ],
  };
}

describe('FeatureExtractionService', () => {
  test('extracts stable activity features from topic and reply activities', () => {
    const features = new FeatureExtractionService().extract(
      featureInput({
        activities: [
          activity({
            id: 'topic-1',
            type: 'topic',
            publishedAt: '2026-03-20T10:00:00.000Z',
          }),
          activity({
            id: 'reply-1',
            type: 'reply',
            publishedAt: '2026-03-21T10:00:00.000Z',
          }),
          activity({
            id: 'reply-2',
            type: 'reply',
            publishedAt: '2026-03-21T18:00:00.000Z',
          }),
        ],
      }),
    );

    expect(features.activity).toMatchObject({
      totalActivities: 3,
      topicCount: 1,
      replyCount: 2,
      topicRatio: 0.3333,
      replyRatio: 0.6667,
      activeDays: 2,
      activeSpanDays: 2,
      avgActivitiesPerActiveDay: 1.5,
      firstActivityAt: '2026-03-20T10:00:00.000Z',
      lastActivityAt: '2026-03-21T18:00:00.000Z',
      activeCommunities: ['v2ex'],
      activeCommunityCount: 1,
    });
  });

  test('extracts stable content ratios from normalized text', () => {
    const features = new FeatureExtractionService().extract(
      featureInput({
        activities: [
          activity({
            id: 'a1',
            contentText: '   hello   world   ',
            excerpt: '',
          }),
          activity({
            id: 'a2',
            contentText: 'L'.repeat(210),
            excerpt: '',
          }),
          activity({
            id: 'a3',
            contentText: 'Where? https://x.co',
            excerpt: '',
          }),
          activity({
            id: 'a4',
            contentText: '   ',
            excerpt: '',
          }),
        ],
      }),
    );

    expect(features.content).toMatchObject({
      avgTextLength: 60,
      nonEmptyContentRatio: 0.75,
      longFormRatio: 0.25,
      questionRatio: 0.25,
      linkRatio: 0.25,
      substantiveTextRatio: 0.25,
    });
  });

  test('extracts topic and community slices across multiple communities', () => {
    const features = new FeatureExtractionService().extract(
      featureInput({
        activities: [
          activity({
            id: 'v-topic-1',
            community: 'v2ex',
            handle: 'alpha',
            type: 'topic',
            nodeName: 'architecture',
            topicTitle: 'Alpha topic one',
          }),
          activity({
            id: 'v-reply-1',
            community: 'v2ex',
            handle: 'alpha',
            type: 'reply',
            nodeName: 'architecture',
            topicTitle: 'Alpha topic two',
          }),
          activity({
            id: 'g-reply-1',
            community: 'guozaoke',
            handle: 'beta',
            type: 'reply',
            nodeName: 'you-wen-wo-da',
            topicTitle: 'Beta topic one',
          }),
          activity({
            id: 'g-topic-1',
            community: 'guozaoke',
            handle: 'beta',
            type: 'topic',
            topicTitle: 'Beta topic two',
          }),
        ],
        communities: [
          {
            community: 'v2ex',
            handle: 'alpha',
            degraded: false,
            warnings: [],
          },
          {
            community: 'guozaoke',
            handle: 'beta',
            degraded: false,
            warnings: [],
          },
        ],
      }),
    );

    expect(features.topic).toMatchObject({
      uniqueNodeCount: 2,
      topicConcentration: 0.6667,
      diversityScore: 0.6667,
      nodeCoverageRatio: 0.75,
    });
    expect(features.topic.dominantNodes).toEqual([
      { name: 'architecture', count: 2, share: 0.6667 },
      { name: 'you-wen-wo-da', count: 1, share: 0.3333 },
    ]);
    expect(features.community).toMatchObject({
      communityActivityShare: {
        v2ex: 0.5,
        guozaoke: 0.5,
      },
      crossCommunity: true,
    });
    expect(features.community.perCommunityMetrics).toMatchObject({
      'v2ex:alpha': {
        totalActivities: 2,
        topicCount: 1,
        replyCount: 1,
      },
      'guozaoke:beta': {
        totalActivities: 2,
        topicCount: 1,
        replyCount: 1,
      },
    });
  });

  test('extracts data quality flags and sufficientData using the frozen thresholds', () => {
    const service = new FeatureExtractionService();
    const insufficient = service.extract(
      featureInput({
        activities: [
          activity({
            id: 'low-1',
            contentText: 'short',
            publishedAt: '2026-03-20T00:00:00.000Z',
          }),
          activity({
            id: 'low-2',
            contentText: 'tiny',
            publishedAt: '2026-03-20T01:00:00.000Z',
          }),
        ],
        communities: [
          {
            community: 'v2ex',
            handle: 'alpha',
            degraded: true,
            warnings: [
              {
                code: 'PARTIAL_RESULT',
                message: 'Replies were partially available.',
              },
            ],
          },
        ],
      }),
    );
    const sufficient = service.extract(
      featureInput({
        activities: [
          activity({
            id: 's1',
            contentText: 'A sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-20T00:00:00.000Z',
          }),
          activity({
            id: 's2',
            contentText: 'A second sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-21T00:00:00.000Z',
          }),
          activity({
            id: 's3',
            contentText: 'A third sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-22T00:00:00.000Z',
          }),
          activity({
            id: 's4',
            contentText: 'A fourth sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-20T05:00:00.000Z',
          }),
          activity({
            id: 's5',
            contentText: 'A fifth sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-21T05:00:00.000Z',
          }),
          activity({
            id: 's6',
            contentText: 'A sixth sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-22T05:00:00.000Z',
          }),
          activity({
            id: 's7',
            contentText: 'A seventh sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-20T10:00:00.000Z',
          }),
          activity({
            id: 's8',
            contentText: 'An eighth sufficiently substantive entry with twenty characters.',
            publishedAt: '2026-03-21T10:00:00.000Z',
          }),
        ],
        communities: [
          {
            community: 'v2ex',
            handle: 'alpha',
            degraded: false,
            warnings: [],
          },
        ],
      }),
    );

    expect(insufficient.dataQuality).toMatchObject({
      degraded: true,
      evidenceDensity: 0,
      sufficientData: false,
      qualityFlags: [
        'LOW_ACTIVITY_VOLUME',
        'LOW_ACTIVE_DAYS',
        'LOW_TEXT_DENSITY',
        'DEGRADED_SOURCE',
      ],
    });
    expect(sufficient.dataQuality).toMatchObject({
      degraded: false,
      evidenceDensity: 1,
      sufficientData: true,
      qualityFlags: [],
    });
  });
});
