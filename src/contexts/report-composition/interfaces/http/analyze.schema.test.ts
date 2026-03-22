import { describe, expect, test } from 'vitest';
import { analyzeRequestSchema } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';

describe('analyzeRequestSchema', () => {
  test('accepts v2ex as a valid community', () => {
    const result = analyzeRequestSchema.safeParse({
      identity: {
        accounts: [
          {
            community: 'v2ex',
            handle: 'Livid',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  test('accepts guozaoke as a valid community', () => {
    const result = analyzeRequestSchema.safeParse({
      identity: {
        accounts: [
          {
            community: 'guozaoke',
            handle: 'some-user',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  test('accepts multiple accounts while keeping the existing analyze request shape', () => {
    const result = analyzeRequestSchema.safeParse({
      identity: {
        label: 'dual-community-subject',
        accounts: [
          {
            community: 'v2ex',
            handle: 'alpha',
          },
          {
            community: 'guozaoke',
            handle: 'alpha',
          },
        ],
      },
      options: {
        locale: 'zh-CN',
      },
    });

    expect(result.success).toBe(true);
  });

  test('rejects unsupported communities', () => {
    const result = analyzeRequestSchema.safeParse({
      identity: {
        accounts: [
          {
            community: 'github',
            handle: 'octocat',
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });
});
