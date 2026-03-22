import { describe, expect, test } from 'vitest';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';

describe('StaticConnectorRegistry', () => {
  test('returns the registered guozaoke connector', () => {
    const registry = new StaticConnectorRegistry();

    expect(registry.get('guozaoke')).toMatchObject({
      community: 'guozaoke',
      mode: 'public',
    });
  });

  test('keeps the v2ex connector registered', () => {
    const registry = new StaticConnectorRegistry();

    expect(registry.get('v2ex')).toMatchObject({
      community: 'v2ex',
      mode: 'public',
    });
  });

  test('lists all currently registered connectors without dropping existing ones', () => {
    const registry = new StaticConnectorRegistry();
    const communities = registry.list().map((connector) => connector.community);

    expect(communities).toEqual(expect.arrayContaining(['v2ex', 'guozaoke', 'weibo']));
  });
});
