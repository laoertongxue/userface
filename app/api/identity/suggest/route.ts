import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { SuggestIdentityLinks } from '@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks';
import { identitySuggestRequestSchema } from '@/src/contexts/identity-resolution/interfaces/http/identity.schema';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';
import { platformPolicies } from '@/src/contexts/platform-governance/infrastructure/config/policies';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: {
            formErrors: ['Request body must be valid JSON.'],
            fieldErrors: {},
          },
        },
      },
      { status: 400 },
    );
  }

  const parsed = identitySuggestRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await new SuggestIdentityLinks(new StaticConnectorRegistry()).execute(parsed.data, {
      traceId: crypto.randomUUID(),
      timeoutMs: platformPolicies.requestTimeoutMs,
      locale: parsed.data.locale ?? 'zh-CN',
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
            details: error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected server error',
        },
      },
      { status: 500 },
    );
  }
}
