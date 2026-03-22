import { describe, expect, test } from 'vitest';
import {
  V2exParserError,
  parseRepliesPage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';
import { readV2exFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

describe('parseRepliesPage', () => {
  test('extracts reply DTOs from the fixture page', async () => {
    const fixture = await readV2exFixture('replies-page-1.html');
    const parsed = parseRepliesPage(fixture);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.totalPages).toBe(1531);
    expect(parsed.totalReplies).toBe(30613);
    expect(parsed.items[0]).toMatchObject({
      topicTitle: 'V 站 RSS 失效',
      topicUrl: '/t/1198802#reply2',
      nodeName: '反馈',
      publishedAtText: '5 天前',
    });
    expect(parsed.items[1]).toMatchObject({
      topicTitle: '你认为的最强编程 AI 工具？',
      topicUrl: '/t/1198412#reply114',
      nodeName: '程序员',
      publishedAtText: '6 天前',
    });
    expect(parsed.items[0]?.contentText).toContain('Under Attack');
  });

  test('throws SELECTOR_CHANGED when the replies structure drifts', async () => {
    const fixture = await readV2exFixture('replies-page-selector-drift.html');

    expect(() => parseRepliesPage(fixture)).toThrowError(V2exParserError);
    expect(() => parseRepliesPage(fixture)).toThrow(/selector no longer matched/i);
  });

  test('allows empty replies pages when the page explicitly reports zero replies', async () => {
    const fixture = await readV2exFixture('replies-page-empty.html');
    const parsed = parseRepliesPage(fixture);

    expect(parsed.items).toEqual([]);
    expect(parsed.totalReplies).toBe(0);
    expect(parsed.totalPages).toBe(1);
  });
});
