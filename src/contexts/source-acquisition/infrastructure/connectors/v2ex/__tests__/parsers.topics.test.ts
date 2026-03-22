import { describe, expect, test } from 'vitest';
import {
  V2exParserError,
  parseTopicsPage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';
import { readV2exFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

describe('parseTopicsPage', () => {
  test('extracts topic DTOs from the fixture page', async () => {
    const fixture = await readV2exFixture('topics-page-1.html');
    const parsed = parseTopicsPage(fixture);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.totalPages).toBe(389);
    expect(parsed.totalTopics).toBe(7769);
    expect(parsed.items[0]).toMatchObject({
      topicTitle: 'GPT-5.4 Thinking 依然过不了洗车测试',
      topicUrl: '/t/1196407#reply51',
      nodeName: 'OpenAI',
      publishedAtText: '3 天前',
      replyCount: 51,
    });
    expect(parsed.items[1]).toMatchObject({
      topicTitle: '让 Claude Code 汇报工作时用上魔兽 3 兽族农民的配音',
      topicUrl: '/t/1192541#reply81',
      nodeName: 'Claude Code',
      publishedAtText: '6 天前',
      replyCount: 81,
    });
  });

  test('throws SELECTOR_CHANGED when the topics structure drifts', async () => {
    const fixture = await readV2exFixture('topics-page-selector-drift.html');

    expect(() => parseTopicsPage(fixture)).toThrowError(V2exParserError);
    expect(() => parseTopicsPage(fixture)).toThrow(/parsed zero items while page structure appears changed/i);
  });

  test('allows empty topics pages when the page explicitly reports zero topics', async () => {
    const fixture = await readV2exFixture('topics-page-empty.html');
    const parsed = parseTopicsPage(fixture);

    expect(parsed.items).toEqual([]);
    expect(parsed.totalTopics).toBe(0);
    expect(parsed.totalPages).toBe(1);
  });
});
