import { describe, expect, test } from 'vitest';
import { mapMemberProfile } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/mappers';
import { parseMemberProfileJson } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';
import { readV2exFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

describe('mapMemberProfile', () => {
  test('maps parsed profile DTOs to CommunityProfileSnapshot', async () => {
    const fixture = JSON.parse(await readV2exFixture('member-found.json'));
    const parsed = parseMemberProfileJson(fixture);

    if (parsed.status !== 'found') {
      throw new Error('Expected a found member fixture.');
    }

    const profile = mapMemberProfile(parsed);

    expect(profile).toMatchObject({
      community: 'v2ex',
      handle: 'Livid',
      displayName: 'Livid',
      avatarUrl: 'https://cdn.v2ex.com/avatar/c4ca/4238/1_xxxlarge.png?m=1772875844',
      homepageUrl: 'https://sepia.sol.build',
      bio: 'Remember the bigger green',
      registeredAt: '2010-04-25T13:45:46.000Z',
    });
  });
});
