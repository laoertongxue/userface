import type { PortraitReport } from '@/src/contexts/portrait-analysis/domain/aggregates/PortraitReport';
import { ApiPresenter, type AnalyzeResponse } from '@/src/contexts/report-composition/infrastructure/presenters/ApiPresenter';

export class ComposePortraitReport {
  constructor(private readonly apiPresenter: ApiPresenter = new ApiPresenter()) {}

  execute(report: PortraitReport): AnalyzeResponse {
    return this.apiPresenter.present(report);
  }
}
