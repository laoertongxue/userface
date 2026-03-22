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
          当前页面同时支持 <strong>单账号分析</strong> 与 <strong>手工聚合分析</strong>。
          你可以直接分析一个 V2EX / 过早客账号，也可以维护多个账号草稿、请求 suggestion，
          然后直接对当前草稿发起聚合分析。结果区会优先展示 narrative 摘要，但仍显性保留
          warnings、evidence、metrics 与 cluster coverage 作为事实锚点。
        </>
      }
      wide
    >
      <AnalyzeForm />
    </PageShell>
  );
}
