import { describe, expect, test } from 'vitest';
import { V2exConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/connector';
import { readV2exFixture, baseV2exContext } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

describe('V2exConnector.probe', () => {
  test('returns ok=true and resolvedUrl when the member exists', async () => {
    const profile = JSON.parse(await readV2exFixture('member-found.json'));
    const connector = new V2exConnector({
      fetcher: {
        fetchMemberProfileJson: async () => ({
          data: profile,
          fetchedAt: '2026-03-22T10:00:00.000Z',
          route: '/api/members/show.json',
          url: 'https://www.v2ex.com/api/members/show.json?username=Livid',
        }),
        fetchMemberRepliesPage: async () => {
          throw new Error('not used');
        },
        fetchMemberTopicsPage: async () => {
          throw new Error('not used');
        },
      },
      waitForPageJitter: async () => {},
    });

    const result = await connector.probe(
      { community: 'v2ex', handle: 'Livid' },
      baseV2exContext,
    );

    expect(result).toMatchObject({
      ok: true,
      resolvedUrl: 'https://www.v2ex.com/u/Livid',
      warnings: [],
    });
  });

  test('returns ok=false and NOT_FOUND when the member does not exist', async () => {
    const profile = JSON.parse(await readV2exFixture('member-not-found.json'));
    const connector = new V2exConnector({
      fetcher: {
        fetchMemberProfileJson: async () => ({
          data: profile,
          fetchedAt: '2026-03-22T10:00:00.000Z',
          route: '/api/members/show.json',
          url: 'https://www.v2ex.com/api/members/show.json?username=missing',
        }),
        fetchMemberRepliesPage: async () => {
          throw new Error('not used');
        },
        fetchMemberTopicsPage: async () => {
          throw new Error('not used');
        },
      },
      waitForPageJitter: async () => {},
    });

    const result = await connector.probe(
      { community: 'v2ex', handle: 'missing' },
      baseV2exContext,
    );

    expect(result.ok).toBe(false);
    expect(result.warnings).toMatchObject([{ code: 'NOT_FOUND' }]);
  });
});
