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
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>单平台社区用户分析</h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          选择 <strong>V2EX</strong> 或 <strong>过早客</strong>，输入该平台的一个用户标识后，
          页面会通过 <code>/api/analyze</code> 发起单平台分析，并展示当前阶段最关键的结果，便于手工验收。
        </p>
      </header>
      <AnalyzeForm />
    </main>
  );
}
