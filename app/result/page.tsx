export default function ResultPage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Result</span>
        <h1 className="page-title">画像输出模型</h1>
        <p className="lead">
          API presenter 会把领域内部的 `PortraitReport` 组装成稳定的 HTTP 响应结构，方便后续接
          UI 页或外部消费端。
        </p>
      </section>

      <section className="panel">
        <h2>Output Guarantees</h2>
        <ul>
          <li>主标签和摘要始终来自结构化画像对象，不直接暴露 connector 细节。</li>
          <li>warning 是一等输出，抓取不完整不会直接导致整体失败。</li>
          <li>evidence 只引用可追溯的 canonical activity。</li>
          <li>每个 community breakdown 都是独立摘要，便于后续扩展跨社区对比 UI。</li>
        </ul>
      </section>
    </main>
  );
}
