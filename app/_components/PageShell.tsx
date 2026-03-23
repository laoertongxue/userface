import type { CSSProperties, ReactNode } from 'react';

type PageShellProps = {
  title: string;
  description: ReactNode;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
};

export function PageShell({
  title,
  description,
  eyebrow,
  backHref,
  backLabel = '返回',
  actions,
  wide = false,
  children,
}: PageShellProps) {
  const shellStyle: CSSProperties | undefined = wide ? undefined : undefined;

  return (
    <main className={`page-shell${wide ? ' page-shell--wide' : ''}`} style={shellStyle}>
      <div className="page-stack">
        <div className="page-chrome">
          <div className="page-brand-badge">
            <span>Community Portrait</span>
            <strong>Studio</strong>
          </div>
          <p className="page-brand-meta">Narrative-first, fact-grounded</p>
        </div>

        {backHref && (
          <a href={backHref} className="page-back-link">
            ← {backLabel}
          </a>
        )}

        <header className="page-header-card">
          <div className="page-header-card__body">
            {eyebrow && <p className="page-kicker">{eyebrow}</p>}
            <h1 className="page-title">{title}</h1>
            <div className="page-description">{description}</div>
            {actions ? <div className="page-actions">{actions}</div> : null}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
