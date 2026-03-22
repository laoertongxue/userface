import { describe, expect, test } from 'vitest';
import { AnalyzeIdentityCluster } from '@/src/contexts/portrait-analysis/application/use-cases/AnalyzeIdentityCluster';
import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';
import { createIdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';

const compatibilityInput: AnalyzePortraitInput = {
  identityCluster: createIdentityCluster({
    accounts: [
      {
        community: 'v2ex',
        handle: 'alpha',
      },
      {
        community: 'guozaoke',
        handle: 'beta',
      },
    ],
    links: [
      {
        from: {
          community: 'v2ex',
          handle: 'alpha',
        },
        to: {
          community: 'guozaoke',
          handle: 'beta',
        },
        source: 'USER_ASSERTED',
      },
    ],
    mode: 'MANUAL_CLUSTER',
    now: '2026-03-22T00:00:00.000Z',
  }),
  snapshots: [
    {
      ref: {
        community: 'v2ex',
        handle: 'alpha',
      },
      profile: {
        community: 'v2ex',
        handle: 'alpha',
        displayName: 'alpha',
        stats: {},
      },
      activities: [
        {
          id: 'a1',
          community: 'v2ex',
          handle: 'alpha',
          type: 'reply',
          url: 'https://www.v2ex.com/t/1',
          topicTitle: 'First reply',
          contentText: 'This is a thoughtful reply with a question?',
          excerpt: 'This is a thoughtful reply with a question?',
          publishedAt: '2026-03-21T00:00:00.000Z',
          sourceTrace: {
            route: '/member/:username/replies',
            fetchedAt: '2026-03-21T01:00:00.000Z',
            contentHash: 'hash-a1',
          },
        },
      ],
      diagnostics: {
        fetchedPages: 2,
        fetchedItems: 1,
        elapsedMs: 1000,
        degraded: false,
        usedRoutes: ['/api/members/show.json', '/member/:username/replies'],
      },
      warnings: [],
    },
    {
      ref: {
        community: 'guozaoke',
        handle: 'beta',
      },
      profile: {
        community: 'guozaoke',
        handle: 'beta',
        displayName: 'beta',
        stats: {},
      },
      activities: [
        {
          id: 'b1',
          community: 'guozaoke',
          handle: 'beta',
          type: 'topic',
          url: 'https://www.guozaoke.com/t/2',
          topicTitle: 'Second topic',
          contentText: 'A longer topic entry with enough words to keep the baseline engine stable.',
          excerpt: 'A longer topic entry with enough words to keep the baseline engine stable.',
          publishedAt: '2026-03-20T00:00:00.000Z',
          sourceTrace: {
            route: '/u/:id/topics',
            fetchedAt: '2026-03-20T01:00:00.000Z',
            contentHash: 'hash-b1',
          },
        },
      ],
      diagnostics: {
        fetchedPages: 2,
        fetchedItems: 1,
        elapsedMs: 900,
        degraded: true,
        usedRoutes: ['/u/:id', '/u/:id/topics'],
      },
      warnings: [
        {
          code: 'PARTIAL_RESULT',
          message: 'Replies were not available for beta.',
        },
      ],
    },
  ],
  activityStream: {
    activities: [
      {
        id: 'a1',
        community: 'v2ex',
        handle: 'alpha',
        type: 'reply',
        url: 'https://www.v2ex.com/t/1',
        topicTitle: 'First reply',
        contentText: 'This is a thoughtful reply with a question?',
        excerpt: 'This is a thoughtful reply with a question?',
        publishedAt: '2026-03-21T00:00:00.000Z',
        sourceTrace: {
          route: '/member/:username/replies',
          fetchedAt: '2026-03-21T01:00:00.000Z',
          contentHash: 'hash-a1',
        },
      },
      {
        id: 'b1',
        community: 'guozaoke',
        handle: 'beta',
        type: 'topic',
        url: 'https://www.guozaoke.com/t/2',
        topicTitle: 'Second topic',
        contentText: 'A longer topic entry with enough words to keep the baseline engine stable.',
        excerpt: 'A longer topic entry with enough words to keep the baseline engine stable.',
        publishedAt: '2026-03-20T00:00:00.000Z',
        sourceTrace: {
          route: '/u/:id/topics',
          fetchedAt: '2026-03-20T01:00:00.000Z',
          contentHash: 'hash-b1',
        },
      },
    ],
  },
};

describe('AnalyzeIdentityCluster', () => {
  test('still supports the existing PortraitReport envelope after composition', () => {
    const analysis = new AnalyzeIdentityCluster().execute(compatibilityInput);
    const report = new ComposePortraitReport().execute(analysis);

    expect(report).toMatchObject({
      portrait: {
        archetype: 'insufficient-data',
        tags: expect.arrayContaining(['low-data', 'cross-community']),
        summary: expect.any(String),
        confidence: expect.any(Number),
      },
      evidence: expect.arrayContaining([
        expect.objectContaining({
          label: expect.any(String),
          excerpt: expect.any(String),
        }),
      ]),
      metrics: {
        totalActivities: 2,
        topicCount: 1,
        replyCount: 1,
        avgTextLength: expect.any(Number),
        activeDays: 2,
      },
      communityBreakdowns: expect.arrayContaining([
        expect.objectContaining({
          community: 'v2ex',
          handle: 'alpha',
        }),
        expect.objectContaining({
          community: 'guozaoke',
          handle: 'beta',
        }),
      ]),
      warnings: [
        {
          code: 'PARTIAL_RESULT',
          message: 'Replies were not available for beta.',
        },
      ],
      cluster: expect.objectContaining({
        stableTraits: expect.any(Array),
        communitySpecificTraits: expect.any(Object),
        confidence: expect.objectContaining({
          overall: expect.any(Number),
        }),
        accountCoverage: expect.objectContaining({
          requestedAccounts: expect.any(Array),
          successfulAccounts: expect.any(Array),
          failedAccounts: expect.any(Array),
        }),
      }),
    });
    expect(report.evidence.length).toBeLessThanOrEqual(5);
  });
});
