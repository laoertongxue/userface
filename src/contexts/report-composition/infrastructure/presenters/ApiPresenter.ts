import type { PortraitReport } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';

export type AnalyzeResponse = PortraitReport;

export class ApiPresenter {
  present(report: PortraitReport): AnalyzeResponse {
    return report;
  }
}
