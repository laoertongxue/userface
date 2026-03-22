import { communityCatalog } from '@/src/config/communities';

const endpoints = [
  'POST /api/analyze',
  'POST /api/identity/suggest',
  'GET /api/health/connectors',
  'POST /api/prompt/preview',
];

const contexts = [
  'identity-resolution',
  'source-acquisition',
  'activity-normalization',
  'portrait-analysis',
  'report-composition',
  'platform-governance',
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Modular Monolith</span>
        <h1>社区用户画像分析</h1>
        <p>
          当前仓库已经按“模块化单体 + DDD + Connector/ACL”落好第一层骨架。外部社区接入统一从
          connector 边界进入，画像主链路只消费标准化后的 profile、activity、evidence 和 metrics。
        </p>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>Bounded Contexts</h2>
          <div className="pill-row">
            {contexts.map((context) => (
              <span className="pill" key={context}>
                {context}
              </span>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Community Connectors</h2>
          <ul>
            {communityCatalog.map((community) => (
              <li key={community.id}>
                <strong>{community.label}</strong> · mode={community.mode} ·{' '}
                {community.status}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section grid two">
        <article className="panel">
          <h2>Current API Surface</h2>
          <ul>
            {endpoints.map((endpoint) => (
              <li key={endpoint}>{endpoint}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Next Implementation Step</h2>
          <p>
            目录、契约、编排入口和占位规则链已经就位。下一步直接在
            `source-acquisition/infrastructure/connectors/v2ex` 和
            `guozaoke` 下补真实抓取、解析、映射与测试，不需要再改画像域边界。
          </p>
        </article>
      </section>
    </main>
  );
}
