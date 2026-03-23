import { PageShell } from '@/app/_components/PageShell';
import { AnalyzeForm } from '@/app/analyze/_components/AnalyzeForm';

export default function AnalyzePage() {
  return (
    <PageShell
      variant="workspace"
      backHref="/"
      backLabel="返回首页"
      eyebrow="Analysis Workspace"
      title="分析"
      description={
        <>
          在同一条结果链路里切换 <strong>单账号</strong> 与 <strong>手工聚合</strong>。输入区、suggestion 审阅和结果区共享同一套工作台布局，
          narrative 作为阅读入口，但 warnings、evidence、metrics 与 coverage 仍然是直接可见的事实锚点。
        </>
      }
      wide
    >
      <AnalyzeForm />
    </PageShell>
  );
}
