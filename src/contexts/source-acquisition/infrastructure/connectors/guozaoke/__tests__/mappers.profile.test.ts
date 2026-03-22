import { describe, expect, test } from 'vitest';
import { mapUserProfile } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/mappers';

describe('Guozaoke profile mapper', () => {
  test('maps a parsed profile DTO into CommunityProfileSnapshot', () => {
    const mapped = mapUserProfile({
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

    expect(mapped).toMatchObject({
      community: 'guozaoke',
      handle: 'sample-user',
      displayName: '示例用户',
      avatarUrl: 'https://www.guozaoke.com/static/avatar/sample.png',
      bio: '长期关注投资与房产。',
      homepageUrl: 'https://example.com',
      stats: {
        favorites: 2,
        replies: 12,
        topics: 8,
      },
    });
    expect(mapped.registeredAt).toBe('2022-08-18T16:00:00.000Z');
  });

  test('does not fabricate missing optional fields', () => {
    const mapped = mapUserProfile({
      status: 'found',
      handle: 'minimal-user',
      stats: {},
    });

    expect(mapped).toMatchObject({
      community: 'guozaoke',
      handle: 'minimal-user',
      displayName: 'minimal-user',
      stats: {},
    });
    expect(mapped.avatarUrl).toBeUndefined();
    expect(mapped.bio).toBeUndefined();
    expect(mapped.homepageUrl).toBeUndefined();
    expect(mapped.registeredAt).toBeUndefined();
  });
});
