import { createHash } from 'node:crypto';

const FULLY_REDACTED_KEYS = new Set([
  'apiKey',
  'apikey',
  'authorization',
  'bearerToken',
  'bodyText',
  'content',
  'contentText',
  'cookie',
  'cookies',
  'evidence',
  'excerpt',
  'html',
  'prompt',
  'promptPayload',
  'rawHtml',
  'rawPrompt',
  'rawResponse',
  'response',
  'token',
].map((key) => key.trim().toLowerCase()));

const HASHED_IDENTIFIER_KEYS = new Set([
  'activityUrl',
  'displayName',
  'handle',
  'homepageUrl',
  'uid',
  'url',
].map((key) => key.trim().toLowerCase()));

const MAX_INLINE_STRING_LENGTH = 120;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function redactString(value: string, key?: string): string {
  if (!value.trim()) {
    return value;
  }

  const normalizedKey = key ? normalizeKey(key) : '';

  if (FULLY_REDACTED_KEYS.has(normalizedKey)) {
    return '[REDACTED]';
  }

  if (HASHED_IDENTIFIER_KEYS.has(normalizedKey)) {
    return `hash:${hashIdentifier(value)}`;
  }

  if (value.length > MAX_INLINE_STRING_LENGTH) {
    return `[REDACTED_TEXT:length=${value.length}]`;
  }

  return value;
}

function sanitizeArray(value: unknown[], key?: string): unknown[] {
  return value.slice(0, 20).map((item) => sanitizeValue(item, key));
}

function sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
  const sanitizedEntries = Object.entries(value)
    .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue, key)] as const)
    .filter((entry) => entry[1] !== undefined);

  return Object.fromEntries(sanitizedEntries);
}

export function sanitizeValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactString(value, key);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return sanitizeArray(value, key);
  }

  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return undefined;
}

export class RedactionPolicy {
  sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) {
      return undefined;
    }

    const sanitized = sanitizeObject(context);

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }
}
