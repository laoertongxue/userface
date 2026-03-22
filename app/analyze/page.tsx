import { AnalyzeForm } from '@/app/analyze/_components/AnalyzeForm';

export default function AnalyzePage() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 20px 64px',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <a href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← 返回首页
        </a>
      </div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>社区画像分析工作台</h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          当前页面同时支持 <strong>单账号分析</strong> 与 <strong>手工聚合分析</strong>。
          你可以直接分析一个 V2EX / 过早客账号，也可以在本地维护多个账号草稿、请求关联建议，并基于当前草稿调用 <code>/api/analyze</code> 做聚合画像分析。
        </p>
      </header>
      <AnalyzeForm />
    </main>
  );
}
