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
        当前 MVP 支持 <strong>V2EX</strong> 与 <strong>过早客</strong> 的
        <strong>单账号分析</strong>，也支持基于多个账号草稿的<strong>手工聚合分析</strong>。系统不会持久化用户数据到服务端，会基于公开接口与公开页面的实时抓取结果生成结构化画像。
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
          <li>选择单账号模式，分析一个 V2EX 或过早客账号</li>
          <li>切换到手工聚合模式，维护多个账号草稿并发起聚合分析</li>
          <li>请求关联建议，但 suggestion 只做建议，不自动合并</li>
          <li>通过现有的 <code>/api/analyze</code> 与 <code>/api/identity/suggest</code> 走完整条工作流</li>
          <li>查看画像摘要、指标、证据、社区分解与 cluster 聚合信息</li>
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
