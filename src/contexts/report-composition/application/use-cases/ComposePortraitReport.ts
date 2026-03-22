import type { ComposePortraitReportInput } from '@/src/contexts/report-composition/application/dto/ComposePortraitReportInput';
import { ReportBuilder } from '@/src/contexts/report-composition/domain/services/ReportBuilder';
import { ApiPresenter, type AnalyzeResponse } from '@/src/contexts/report-composition/infrastructure/presenters/ApiPresenter';

export class ComposePortraitReport {
  constructor(
    private readonly reportBuilder: ReportBuilder = new ReportBuilder(),
    private readonly apiPresenter: ApiPresenter = new ApiPresenter(),
  ) {}

  execute(input: ComposePortraitReportInput): AnalyzeResponse {
    return this.apiPresenter.present(this.reportBuilder.build(input));
  }
}
