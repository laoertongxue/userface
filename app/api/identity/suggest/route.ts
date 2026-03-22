import { NextResponse } from 'next/server';
import { SuggestIdentityLinks } from '@/src/contexts/identity-resolution/application/use-cases/SuggestIdentityLinks';
import { identitySuggestRequestSchema } from '@/src/contexts/identity-resolution/interfaces/http/identity.schema';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = identitySuggestRequestSchema.parse(body);
    const suggestions = new SuggestIdentityLinks().execute(parsed);

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 },
    );
  }
}
