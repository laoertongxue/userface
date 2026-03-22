import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const guozaokeFixturesDir = join(
  process.cwd(),
  'src/contexts/source-acquisition/infrastructure/connectors/guozaoke/fixtures',
);

export async function readGuozaokeFixture(fileName: string): Promise<string> {
  return readFile(join(guozaokeFixturesDir, fileName), 'utf8');
}

export const baseGuozaokeContext = {
  locale: 'zh-CN' as const,
  timeoutMs: 15_000,
  traceId: 'trace-guozaoke-test',
};

export const guozaokeFetchedAt = '2026-03-22T10:00:00.000Z';
