import { PageShell } from '@/app/_components/PageShell';

export default function HomePage() {
  return (
    <PageShell
      eyebrow="Community Portrait Studio"
      title="社区画像分析"
      description={
        <>
          一个围绕 <strong>结构化事实</strong> 与 <strong>受控 narrative</strong>{' '}
          组织的社区画像工作台。当前支持 <strong>V2EX</strong> 与 <strong>过早客</strong>{' '}
          的单账号分析，也支持基于多个账号草稿的手工聚合分析；所有 cluster draft 仅保存在本地浏览器。
        </>
      }
      actions={
        <>
          <a href="/analyze" className="button-link button-link--primary">
            进入分析页
          </a>
          <a href="/analyze" className="button-link button-link--secondary">
            打开工作台
          </a>
        </>
      }
    >
      <section className="surface-card surface-card--muted">
        <div className="surface-card__body">
          <div className="home-mini-grid">
            <div className="home-stat">
              <strong>2</strong>
              <p className="home-card-text">公开社区数据源</p>
            </div>
            <div className="home-stat">
              <strong>2</strong>
              <p className="home-card-text">单账号 / 手工聚合模式</p>
            </div>
            <div className="home-stat">
              <strong>1</strong>
              <p className="home-card-text">统一的事实层与叙事层结果页</p>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="surface-card__body">
          <div className="home-grid">
            <article className="surface-card surface-card--muted">
              <div className="surface-card__body">
                <h2 className="home-card-title">分析入口</h2>
                <p className="home-card-text">
                  单账号可直接查看公开活动画像；聚合模式可手工维护多个账号、请求 suggestion，并把当前草稿直接送入聚合分析链路。
                </p>
              </div>
            </article>
            <article className="surface-card surface-card--muted">
              <div className="surface-card__body">
                <h2 className="home-card-title">结果阅读</h2>
                <p className="home-card-text">
                  结果区会优先给出 headline 与 short summary，但 archetype、tags、confidence、evidence、warnings 和 cluster insights 仍然显性存在。
                </p>
              </div>
            </article>
            <article className="surface-card surface-card--muted">
              <div className="surface-card__body">
                <h2 className="home-card-title">边界</h2>
                <p className="home-card-text">
                  suggestion 只做建议，不自动合并；规则事实层始终是事实源；本地草稿不会被持久化到服务端。
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
