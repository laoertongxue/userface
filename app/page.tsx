export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '48px 20px 64px',
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>社区用户画像分析</h1>
      <p style={{ marginTop: 0, lineHeight: 1.6 }}>
        当前 MVP 只支持 <strong>V2EX 单平台分析</strong>。系统不会持久化用户数据，会基于公开接口与公开页面的实时抓取结果生成结构化画像。
      </p>
      <section
        style={{
          marginTop: 24,
          padding: 20,
          border: '1px solid #d1d5db',
          borderRadius: 12,
          background: '#ffffff',
        }}
      >
        <h2 style={{ marginTop: 0 }}>当前可验收范围</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>输入一个 V2EX 用户名并发起分析</li>
          <li>通过现有的 <code>/api/analyze</code> 走完整条后端链路</li>
          <li>查看画像摘要、指标、证据、社区分解与 warnings</li>
        </ul>
        <a
          href="/analyze"
          style={{
            display: 'inline-block',
            marginTop: 8,
            padding: '10px 16px',
            borderRadius: 8,
            background: '#111827',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          进入分析页
        </a>
      </section>
    </main>
  );
}
