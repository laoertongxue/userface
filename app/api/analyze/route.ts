import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { runAnalyzePipeline } from '@/src/app-services/analyze/runAnalyzePipeline';
import { analyzeRequestSchema } from '@/src/contexts/report-composition/interfaces/http/analyze.schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
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

  const parsed = analyzeRequestSchema.safeParse(body);

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
    const result = await runAnalyzePipeline(parsed.data);

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
