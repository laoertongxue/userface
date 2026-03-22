import { describe, expect, test } from 'vitest';
import {
  GuozaokeParserError,
  parseRepliesPage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/parsers';
import { readGuozaokeFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';

describe('Guozaoke replies parser', () => {
  test('parses a valid replies page into reply DTOs', async () => {
    const html = await readGuozaokeFixture('replies-page-1.html');
    const parsed = parseRepliesPage(html);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.totalPages).toBe(2);
    expect(parsed.totalReplies).toBe(12);
    expect(parsed.items[0]).toMatchObject({
      topicTitle: '第一条主题',
      topicUrl: '/t/1001',
      contentText: '第一条回复内容',
      publishedAtText: '昨天',
      nodeName: '金融财经',
    });
    expect(parsed.items[1]).toMatchObject({
      topicTitle: '第二条主题',
      topicUrl: '/t/1002',
      contentText: '第二条回复内容 带换行',
      publishedAtText: '2 天前',
    });
  });

  test('returns an explicit empty result when the page clearly has no replies', async () => {
    const html = await readGuozaokeFixture('replies-empty.html');
    const parsed = parseRepliesPage(html);

    expect(parsed).toMatchObject({
      items: [],
      totalReplies: 0,
    });
  });

  test('throws selector mismatch when the replies structure drifts', async () => {
    const html = await readGuozaokeFixture('replies-selector-drift.html');

    expect(() => parseRepliesPage(html)).toThrowError(
      new GuozaokeParserError(
        'SELECTOR_CHANGED',
        'Guozaoke replies selector mismatch: expected reply items were not found.',
      ),
    );
  });
});
