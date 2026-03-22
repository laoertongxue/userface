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
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>V2EX 用户分析</h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          输入一个真实的 V2EX 用户名，页面会通过 <code>/api/analyze</code>{' '}
          发起分析，并展示第 1 阶段最关键的结果，便于手工验收。
        </p>
      </header>
      <AnalyzeForm />
    </main>
  );
}
