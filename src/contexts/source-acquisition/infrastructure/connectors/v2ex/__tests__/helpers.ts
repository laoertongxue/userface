import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const v2exFixturesDir = join(
  process.cwd(),
  'src/contexts/source-acquisition/infrastructure/connectors/v2ex/fixtures',
);

export async function readV2exFixture(fileName: string): Promise<string> {
  return readFile(join(v2exFixturesDir, fileName), 'utf8');
}

export const baseV2exContext = {
  locale: 'zh-CN' as const,
  timeoutMs: 15_000,
  traceId: 'trace-v2ex-test',
};
