import { describe, expect, test } from 'vitest';
import {
  GuozaokeParserError,
  parseTopicsPage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/parsers';
import { readGuozaokeFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/__tests__/helpers';

describe('Guozaoke topics parser', () => {
  test('parses a valid topics page into topic DTOs', async () => {
    const html = await readGuozaokeFixture('topics-page-1.html');
    const parsed = parseTopicsPage(html);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.totalPages).toBe(2);
    expect(parsed.totalTopics).toBe(8);
    expect(parsed.items[0]).toMatchObject({
      topicTitle: '过早客第一条主题',
      topicUrl: '/t/2001#reply6',
      nodeName: '金融财经',
      publishedAtText: '2 天前',
      replyCount: 6,
    });
    expect(parsed.items[1]).toMatchObject({
      topicTitle: '过早客第二条主题',
      topicUrl: '/t/2002#reply3',
      nodeName: '你问我答',
      publishedAtText: '1 周前',
      replyCount: 3,
    });
  });

  test('returns an explicit empty result when the page clearly has no topics', async () => {
    const html = await readGuozaokeFixture('topics-empty.html');
    const parsed = parseTopicsPage(html);

    expect(parsed).toMatchObject({
      items: [],
      totalTopics: 0,
    });
  });

  test('throws selector mismatch when the topics structure drifts', async () => {
    const html = await readGuozaokeFixture('topics-selector-drift.html');

    expect(() => parseTopicsPage(html)).toThrowError(
      new GuozaokeParserError(
        'SELECTOR_CHANGED',
        'Guozaoke topics selector mismatch: expected topic items were not found.',
      ),
    );
  });
});
