import { NextResponse } from 'next/server';
import { promptPreviewRequestSchema } from '@/src/contexts/report-composition/interfaces/http/prompt-preview.schema';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = promptPreviewRequestSchema.parse(body);
    const prompt = [
      'You are a narrative layer for a community portrait product.',
      'Use only the structured facts below.',
      `Archetype: ${parsed.portrait.archetype}`,
      `Tags: ${parsed.portrait.tags.join(', ') || 'none'}`,
      `Summary seed: ${parsed.portrait.summary}`,
      `Metrics: ${JSON.stringify(parsed.metrics)}`,
      `Evidence: ${parsed.evidence.map((item) => `[${item.community}] ${item.excerpt}`).join(' | ') || 'none'}`,
      'Constraints: do not invent facts, keep claims evidence-backed, prefer concise Chinese output.',
    ].join('\n');

    return NextResponse.json({ prompt });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 },
    );
  }
}
