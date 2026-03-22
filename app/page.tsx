const exampleRequest = {
  identity: {
    label: 'demo-cluster',
    accounts: [
      {
        community: 'v2ex',
        handle: 'Livid',
      },
    ],
  },
  options: {
    maxPagesPerCommunity: 3,
    maxItemsPerCommunity: 120,
    includeTopics: true,
    includeReplies: true,
    locale: 'zh-CN',
    llmProvider: 'none',
  },
};

export default function HomePage() {
  return (
    <main>
      <h1>社区用户画像分析</h1>
      <p>当前应用骨架已经接通，但所有 connector 仍然是 stub，尚未实现真实抓取。</p>
      <p>可以直接调用 <code>POST /api/analyze</code> 测试现有分析链路。</p>
      <pre>{JSON.stringify(exampleRequest, null, 2)}</pre>
    </main>
  );
}
