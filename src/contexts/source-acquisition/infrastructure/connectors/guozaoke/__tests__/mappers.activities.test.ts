import { describe, expect, test } from 'vitest';
import {
  mapReplyActivity,
  mapTopicActivity,
} from '@/src/contexts/source-acquisition/infrastructure/connectors/guozaoke/mappers';

describe('Guozaoke activity mappers', () => {
  test('reply mapper produces stable ids, absolute URLs, and sourceTrace', () => {
    const source = {
      fetchedAt: '2026-03-22T10:00:00.000Z',
      handle: 'sample-user',
      route: '/u/:id/replies',
    };
    const reply = {
      contentText: '第一条回复内容',
      excerpt: '第一条回复内容',
      nodeName: '金融财经',
      publishedAtText: '昨天',
      topicTitle: '第一条主题',
      topicUrl: '/t/1001',
    };

    const first = mapReplyActivity(reply, source);
    const second = mapReplyActivity(reply, source);

    expect(first.id).toBe(second.id);
    expect(first.type).toBe('reply');
    expect(first.url).toBe('https://www.guozaoke.com/t/1001');
    expect(first.sourceTrace).toMatchObject({
      route: '/u/:id/replies',
      fetchedAt: '2026-03-22T10:00:00.000Z',
    });
  });

  test('topic mapper produces stable ids, absolute URLs, and sourceTrace', () => {
    const source = {
      fetchedAt: '2026-03-22T10:00:00.000Z',
      handle: 'sample-user',
      route: '/u/:id/topics',
    };
    const topic = {
      contentText: '过早客第一条主题',
      excerpt: '过早客第一条主题',
      nodeName: '金融财经',
      publishedAtText: '2 天前',
      replyCount: 6,
      topicTitle: '过早客第一条主题',
      topicUrl: '/t/2001#reply6',
    };

    const first = mapTopicActivity(topic, source);
    const second = mapTopicActivity(topic, source);

    expect(first.id).toBe(second.id);
    expect(first.type).toBe('topic');
    expect(first.url).toBe('https://www.guozaoke.com/t/2001#reply6');
    expect(first.stats?.replyCount).toBe(6);
    expect(first.sourceTrace).toMatchObject({
      route: '/u/:id/topics',
      fetchedAt: '2026-03-22T10:00:00.000Z',
    });
  });
});
