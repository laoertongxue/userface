import type { CSSProperties } from 'react';

export const pageSectionGap = 22;

export const panelStyle: CSSProperties = {
  padding: 'var(--card-padding)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--surface-card)',
  boxShadow: 'var(--shadow-soft)',
};

export const emphasizedPanelStyle: CSSProperties = {
  ...panelStyle,
  borderColor: 'var(--border-accent-soft)',
  background:
    'linear-gradient(180deg, rgba(255,154,60,0.12) 0%, rgba(19,17,15,0.98) 36%, rgba(16,14,13,0.98) 100%)',
};

export const insetPanelStyle: CSSProperties = {
  padding: 18,
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface-muted)',
};

export const cautionPanelStyle: CSSProperties = {
  ...panelStyle,
  borderColor: 'rgba(255, 153, 60, 0.26)',
  background:
    'linear-gradient(180deg, rgba(255,153,60,0.13) 0%, rgba(31,20,15,0.94) 100%)',
};

export const errorPanelStyle: CSSProperties = {
  ...panelStyle,
  borderColor: 'rgba(255, 107, 74, 0.34)',
  background:
    'linear-gradient(180deg, rgba(255,107,74,0.14) 0%, rgba(31,16,14,0.96) 100%)',
};

export const sectionTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  fontSize: 20,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
};

export const subSectionTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 10,
  fontSize: 15,
  lineHeight: 1.35,
  color: 'var(--text-secondary)',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
};

export const eyebrowTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--accent)',
};

export const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
};

export const subtleTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted)',
  lineHeight: 1.6,
};

export const pillBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border-soft)',
  background: 'var(--surface-pill)',
  fontSize: 12,
  lineHeight: 1.4,
  color: 'var(--text-secondary)',
};

export const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  lineHeight: 1.8,
  color: 'var(--text-secondary)',
};

export const metricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
};

export const metricCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface-muted)',
  border: '1px solid var(--border-soft)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

export function buttonStyle(
  kind: 'primary' | 'secondary' | 'danger',
  disabled = false,
): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    padding: '11px 16px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid transparent',
    fontWeight: 600,
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
  };

  if (kind === 'primary') {
    return {
      ...base,
      background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%)',
      color: '#190e06',
      boxShadow: disabled ? 'none' : '0 12px 28px rgba(255,122,44,0.2)',
    };
  }

  if (kind === 'danger') {
    return {
      ...base,
      background: 'rgba(255,107,74,0.14)',
      borderColor: 'rgba(255,107,74,0.3)',
      color: '#ffd9cf',
    };
  }

  return {
    ...base,
    background: 'var(--surface-muted)',
    borderColor: 'var(--border-soft)',
    color: 'var(--text-primary)',
  };
}

export const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--border-soft)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
  fontSize: 15,
  lineHeight: 1.5,
  boxSizing: 'border-box',
  outline: 'none',
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: 'none',
};

export function segmentedButtonStyle(active: boolean, disabled = false): CSSProperties {
  return {
    ...pillBaseStyle,
    minHeight: 42,
    padding: '10px 14px',
    background: active ? 'rgba(255,154,60,0.16)' : 'var(--surface-pill)',
    borderColor: active ? 'var(--border-accent-soft)' : 'var(--border-soft)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    fontWeight: active ? 700 : 600,
  };
}

export const infoGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

export function itemCardStyle(tone: 'default' | 'accent' | 'warning' = 'default'): CSSProperties {
  const style: CSSProperties = {
    padding: 16,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-soft)',
    background: 'var(--surface-muted)',
  };

  if (tone === 'accent') {
    return {
      ...style,
      borderColor: 'var(--border-accent-soft)',
      background:
        'linear-gradient(180deg, rgba(255,154,60,0.08) 0%, rgba(21,18,16,0.96) 100%)',
    };
  }

  if (tone === 'warning') {
    return {
      ...style,
      borderColor: 'rgba(255, 153, 60, 0.26)',
      background:
        'linear-gradient(180deg, rgba(255,153,60,0.1) 0%, rgba(28,19,15,0.96) 100%)',
    };
  }

  return style;
}

export function formatValue(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return 'N/A';
  }

  return String(value);
}

export function formatConfidence(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }

  return `${Math.round(value * 100)}%`;
}

export function formatDateTime(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function hasText(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}
