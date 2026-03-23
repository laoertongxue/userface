import { createHash } from 'node:crypto';
import type { GovernedRoute } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';

function firstHeaderValue(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)?.trim();

  if (!value) {
    return undefined;
  }

  return value.split(',')[0]?.trim() || undefined;
}

export function createRequestFingerprint(request: Request, route: GovernedRoute): string {
  const forwardedFor = firstHeaderValue(request.headers, 'x-forwarded-for');
  const realIp = firstHeaderValue(request.headers, 'x-real-ip');
  const cfIp = firstHeaderValue(request.headers, 'cf-connecting-ip');
  const userAgent = request.headers.get('user-agent')?.trim() || 'unknown-user-agent';
  const source = forwardedFor || realIp || cfIp || 'unknown-ip';
  const rawFingerprint = `${route}:${source}:${userAgent}`;
  const hash = createHash('sha256').update(rawFingerprint).digest('hex').slice(0, 16);

  return `fp_${hash}`;
}
