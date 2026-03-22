import { describe, expect, test } from 'vitest';
import {
  mapReplyActivity,
  mapTopicActivity,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/mappers';
import {
  parseRepliesPage,
  parseTopicsPage,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/parsers';
import { readV2exFixture } from '@/src/contexts/source-acquisition/infrastructure/connectors/v2ex/__tests__/helpers';

const source = {
  fetchedAt: '2026-03-22T10:00:00.000Z',
  handle: 'Livid',
  route: '/member/:username/replies',
};

describe('V2EX activity mappers', () => {
  test('maps replies to stable canonical activities with absolute URLs', async () => {
    const fixture = await readV2exFixture('replies-page-1.html');
    const parsed = parseRepliesPage(fixture);
    const activityA = mapReplyActivity(parsed.items[0]!, source);
    const activityB = mapReplyActivity(parsed.items[0]!, source);

    expect(activityA).toMatchObject({
      community: 'v2ex',
      handle: 'Livid',
      type: 'reply',
      url: 'https://www.v2ex.com/t/1198802#reply2',
      topicId: '1198802',
      topicTitle: 'V 站 RSS 失效',
    });
    expect(activityA.sourceTrace).toMatchObject({
      route: '/member/:username/replies',
      fetchedAt: '2026-03-22T10:00:00.000Z',
    });
    expect(activityA.id).toBe(activityB.id);
    expect(activityA.sourceTrace.contentHash).toBe(activityB.sourceTrace.contentHash);
  });

  test('maps topics to stable canonical activities with absolute URLs', async () => {
    const fixture = await readV2exFixture('topics-page-1.html');
    const parsed = parseTopicsPage(fixture);
    const activityA = mapTopicActivity(parsed.items[0]!, {
      ...source,
      route: '/member/:username/topics',
    });
    const activityB = mapTopicActivity(parsed.items[0]!, {
      ...source,
      route: '/member/:username/topics',
    });

    expect(activityA).toMatchObject({
      community: 'v2ex',
      handle: 'Livid',
      type: 'topic',
      url: 'https://www.v2ex.com/t/1196407#reply51',
      topicId: '1196407',
      topicTitle: 'GPT-5.4 Thinking 依然过不了洗车测试',
      stats: {
        replyCount: 51,
      },
    });
    expect(activityA.sourceTrace).toMatchObject({
      route: '/member/:username/topics',
      fetchedAt: '2026-03-22T10:00:00.000Z',
    });
    expect(activityA.id).toBe(activityB.id);
    expect(activityA.sourceTrace.contentHash).toBe(activityB.sourceTrace.contentHash);
  });
});
