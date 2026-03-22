import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ACCEPT_HEADER,
  DEFAULT_USER_AGENT,
  buildDefaultHeaders,
  headersToObject,
} from '@/src/contexts/source-acquisition/infrastructure/http/headers';

describe('buildDefaultHeaders', () => {
  test('includes default headers', () => {
    const headers = headersToObject(buildDefaultHeaders());

    expect(headers.accept).toBe(DEFAULT_ACCEPT_HEADER);
    expect(headers['user-agent']).toBe(DEFAULT_USER_AGENT);
  });

  test('allows callers to override defaults', () => {
    const headers = headersToObject(
      buildDefaultHeaders({
        headers: {
          Accept: 'application/json',
          'User-Agent': 'custom-agent/1.0',
          'X-Test': 'yes',
        },
      }),
    );

    expect(headers.accept).toBe('application/json');
    expect(headers['user-agent']).toBe('custom-agent/1.0');
    expect(headers['x-test']).toBe('yes');
  });
});
