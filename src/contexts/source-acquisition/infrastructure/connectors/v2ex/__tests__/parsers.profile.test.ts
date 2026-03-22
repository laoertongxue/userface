import { describe, expect, test } from 'vitest';
import { parseMemberProfileJson } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';
import { readV2exFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

describe('parseMemberProfileJson', () => {
  test('parses a found member payload', async () => {
    const fixture = JSON.parse(await readV2exFixture('member-found.json'));
    const parsed = parseMemberProfileJson(fixture);

    expect(parsed).toMatchObject({
      status: 'found',
      username: 'Livid',
      avatarUrl: 'https://cdn.v2ex.com/avatar/c4ca/4238/1_xxxlarge.png?m=1772875844',
      profileUrl: 'https://www.v2ex.com/u/Livid',
      website: 'sepia.sol.build',
    });
  });

  test('enters the not-found branch for not-found payloads', async () => {
    const fixture = JSON.parse(await readV2exFixture('member-not-found.json'));
    const parsed = parseMemberProfileJson(fixture);

    expect(parsed).toEqual({
      status: 'not_found',
    });
  });
});
