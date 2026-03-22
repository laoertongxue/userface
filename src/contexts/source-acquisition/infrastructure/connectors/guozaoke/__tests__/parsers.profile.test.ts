import { describe, expect, test } from 'vitest';
import {
  GuozaokeParserError,
  parseUserProfilePage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/parsers';
import { readGuozaokeFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';

describe('Guozaoke profile parser', () => {
  test('parses a valid user page into a stable profile DTO', async () => {
    const html = await readGuozaokeFixture('user-page.html');
    const parsed = parseUserProfilePage(html);

    expect(parsed).toMatchObject({
      status: 'found',
      avatarUrl: '/static/avatar/sample.png',
      bio: '长期关注投资与房产。',
      displayName: '示例用户',
      handle: 'sample-user',
      homepageUrl: 'https://example.com',
      profileUrl: '/u/sample-user',
      registeredAtText: '2022-08-19',
      stats: {
        favorites: 2,
        replies: 12,
        topics: 8,
      },
    });
  });

  test('returns not_found for a missing user page', async () => {
    const html = await readGuozaokeFixture('user-not-found.html');

    expect(parseUserProfilePage(html)).toEqual({
      status: 'not_found',
    });
  });

  test('throws selector mismatch when the profile structure drifts', async () => {
    const html = await readGuozaokeFixture('user-selector-drift.html');

    expect(() => parseUserProfilePage(html)).toThrowError(
      new GuozaokeParserError(
        'SELECTOR_CHANGED',
        'Guozaoke profile page structure was unexpected: missing profile root.',
      ),
    );
  });
});
