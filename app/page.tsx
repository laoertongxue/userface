import { PageShell } from '@/app/_components/PageShell';

export default function HomePage() {
  return (
    <PageShell
      eyebrow="Community Portrait Studio"
      title="社区画像分析"
      description={
        <>
          当前工作台支持 <strong>V2EX</strong> 与 <strong>过早客</strong> 的
          <strong>单账号分析</strong>，也支持基于多个账号草稿的
          <strong>手工聚合分析</strong>。结果会同时保留结构化事实与 narrative 摘要，
          但不会把你的草稿持久化到服务端。
        </>
      }
      actions={
        <>
          <a href="/analyze" className="button-link button-link--primary">
            进入分析页
          </a>
          <a href="/analyze" className="button-link button-link--secondary">
            查看聚合工作台
          </a>
        </>
      }
    >
      <section className="surface-card">
        <div className="surface-card__body">
          <div className="home-grid">
            <article className="surface-card surface-card--muted">
              <div className="surface-card__body">
                <h2 className="home-card-title">支持范围</h2>
                <p className="home-card-text">
                  支持单账号分析、手工聚合分析、关联建议、本地草稿保存，以及
                  narrative-enhanced 结果阅读。
                </p>
              </div>
            </article>
            <article className="surface-card surface-card--muted">
              <div className="surface-card__body">
                <h2 className="home-card-title">结果结构</h2>
                <p className="home-card-text">
                  结果页会同时显示 headline、short summary、archetype、tags、
                  confidence、evidence、warnings 与 cluster insight。
                </p>
              </div>
            </article>
            <article className="surface-card surface-card--muted">
              <div className="surface-card__body">
                <h2 className="home-card-title">边界说明</h2>
                <p className="home-card-text">
                  suggestion 只做建议，不自动合并；cluster draft 只保存在浏览器；
                  规则事实层依旧是最终事实源。
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
