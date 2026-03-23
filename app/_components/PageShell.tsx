import type { CSSProperties, ReactNode } from 'react';

type PageShellProps = {
  title: string;
  description: ReactNode;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  variant?: 'landing' | 'workspace';
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
  variant = 'landing',
  wide = false,
  children,
}: PageShellProps) {
  const shellStyle: CSSProperties | undefined = wide ? undefined : undefined;
  const shellClassName = `page-shell page-shell--${variant}${wide ? ' page-shell--wide' : ''}`;

  return (
    <main className={shellClassName} style={shellStyle}>
      <div className="page-stack">
        <div className="page-chrome">
          <div className="page-brand-badge">
            <span>COMMUNITY PORTRAIT</span>
            <strong>Studio</strong>
          </div>
          <p className="page-brand-meta">Narrative-first, fact-grounded</p>
        </div>

        {backHref && (
          <a href={backHref} className="page-back-link">
            ← {backLabel}
          </a>
        )}

        {variant === 'workspace' ? (
          <section className="workspace-panel">
            <header className="workspace-panel__header">
              {eyebrow && <p className="page-kicker page-kicker--workspace">{eyebrow}</p>}
              <h1 className="workspace-panel__title">{title}</h1>
              <div className="workspace-panel__description">{description}</div>
              {actions ? <div className="page-actions page-actions--workspace">{actions}</div> : null}
            </header>
            <div className="workspace-panel__body">{children}</div>
          </section>
        ) : (
          <>
            <header className="page-header-card page-header-card--landing">
              <div className="page-header-card__body">
                {eyebrow && <p className="page-kicker">{eyebrow}</p>}
                <h1 className="page-title">{title}</h1>
                <div className="page-description">{description}</div>
                {actions ? <div className="page-actions">{actions}</div> : null}
              </div>
            </header>

            {children}
          </>
        )}
      </div>
    </main>
  );
}
