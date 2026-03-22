import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import { AnalyzeIdentityCluster } from '@/src/contexts/portrait-analysis/application/use-cases/AnalyzeIdentityCluster';
import { ComposePortraitReport } from '@/src/contexts/report-composition/application/use-cases/ComposePortraitReport';

export async function runPortraitAnalysis(input: AnalyzePortraitInput) {
  const analysis = new AnalyzeIdentityCluster().execute(input);
  const report = await new ComposePortraitReport().execute(analysis);

  return {
    analysis,
    report,
  };
}
