import { describe, expect, test } from 'vitest';
import { GuozaokeConnector } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/connector';
import {
  baseGuozaokeContext,
  guozaokeFetchedAt,
  readGuozaokeFixture,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';

describe('GuozaokeConnector.probe', () => {
  test('returns ok=true and resolvedUrl when the user exists', async () => {
    const profileHtml = await readGuozaokeFixture('user-page.html');
    const connector = new GuozaokeConnector({
      fetcher: {
        fetchUserProfilePage: async () => ({
          bodyText: profileHtml,
          fetchedAt: guozaokeFetchedAt,
          route: '/u/:id',
          url: 'https://www.guozaoke.com/u/sample-user',
        }),
        fetchUserRepliesPage: async () => {
          throw new Error('not used');
        },
        fetchUserTopicsPage: async () => {
          throw new Error('not used');
        },
      },
      waitForPageJitter: async () => {},
    });

    const result = await connector.probe(
      { community: 'guozaoke', handle: 'sample-user' },
      baseGuozaokeContext,
    );

    expect(result).toMatchObject({
      ok: true,
      resolvedUrl: 'https://www.guozaoke.com/u/sample-user',
      warnings: [],
    });
  });

  test('returns ok=false and NOT_FOUND when the user does not exist', async () => {
    const profileHtml = await readGuozaokeFixture('user-not-found.html');
    const connector = new GuozaokeConnector({
      fetcher: {
        fetchUserProfilePage: async () => ({
          bodyText: profileHtml,
          fetchedAt: guozaokeFetchedAt,
          route: '/u/:id',
          url: 'https://www.guozaoke.com/u/missing-user',
        }),
        fetchUserRepliesPage: async () => {
          throw new Error('not used');
        },
        fetchUserTopicsPage: async () => {
          throw new Error('not used');
        },
      },
      waitForPageJitter: async () => {},
    });

    const result = await connector.probe(
      { community: 'guozaoke', handle: 'missing-user' },
      baseGuozaokeContext,
    );

    expect(result.ok).toBe(false);
    expect(result.warnings).toMatchObject([
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'Guozaoke user "missing-user" was not found.',
      }),
    ]);
  });

  test('returns SELECTOR_CHANGED with a readable message when the profile structure drifts', async () => {
    const profileHtml = await readGuozaokeFixture('user-selector-drift.html');
    const connector = new GuozaokeConnector({
      fetcher: {
        fetchUserProfilePage: async () => ({
          bodyText: profileHtml,
          fetchedAt: guozaokeFetchedAt,
          route: '/u/:id',
          url: 'https://www.guozaoke.com/u/sample-user',
        }),
        fetchUserRepliesPage: async () => {
          throw new Error('not used');
        },
        fetchUserTopicsPage: async () => {
          throw new Error('not used');
        },
      },
      waitForPageJitter: async () => {},
    });

    const result = await connector.probe(
      { community: 'guozaoke', handle: 'sample-user' },
      baseGuozaokeContext,
    );

    expect(result.ok).toBe(false);
    expect(result.warnings).toMatchObject([
      expect.objectContaining({
        code: 'SELECTOR_CHANGED',
        message:
          'Guozaoke profile page structure for "sample-user" did not match the expected selectors.',
      }),
    ]);
  });
});
