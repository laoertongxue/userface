const sampleRequest = `{
  "identity": {
    "label": "sample-cluster",
    "accounts": [
      { "community": "v2ex", "handle": "Livid" },
      { "community": "guozaoke", "handle": "alice" }
    ]
  },
  "options": {
    "maxPagesPerCommunity": 3,
    "maxItemsPerCommunity": 120,
    "includeTopics": true,
    "includeReplies": true,
    "locale": "zh-CN",
    "llmProvider": "none"
  }
}`;

export default function AnalyzePage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Analyze</span>
        <h1 className="page-title">主分析接口</h1>
        <p className="lead">
          `POST /api/analyze` 已经接上验证、identity resolution、connector registry、
          activity normalization、rule-based portrait analysis 和 API presenter。
        </p>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>Sample Request</h2>
          <pre>{sampleRequest}</pre>
        </article>

        <article className="panel">
          <h2>Current Behavior</h2>
          <ul>
            <li>默认走 Node.js runtime。</li>
            <li>所有 connector 都通过统一的 `CommunityConnector` 契约接入。</li>
            <li>当前 V2EX / 过早客 / 微博 connector 只提供占位实现和能力声明。</li>
            <li>画像结果已经支持 partial result 和 warning 聚合。</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
