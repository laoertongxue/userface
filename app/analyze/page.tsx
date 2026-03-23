import { PageShell } from '@/app/_components/PageShell';
import { AnalyzeForm } from '@/app/analyze/_components/AnalyzeForm';

export default function AnalyzePage() {
  return (
    <PageShell
      backHref="/"
      backLabel="返回首页"
      eyebrow="Analysis Workspace"
      title="社区画像分析工作台"
      description={
        <>
          在同一条结果链路里切换 <strong>单账号</strong> 与 <strong>手工聚合</strong>。
          你可以直接分析一个 V2EX / 过早客账号，也可以维护多个账号草稿、请求 suggestion，
          然后把当前草稿直接送入聚合分析。结果区会优先展示 narrative 摘要，但 warnings、evidence、metrics 和 coverage 仍然是直接可见的事实锚点。
        </>
      }
      wide
    >
      <AnalyzeForm />
    </PageShell>
  );
}
