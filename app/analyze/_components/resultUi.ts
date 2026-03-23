import type { CSSProperties } from 'react';

export const pageSectionGap = 22;

export const panelStyle: CSSProperties = {
  padding: 'var(--card-padding)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-soft)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--surface-card)',
  boxShadow: 'var(--shadow-soft)',
};

export const emphasizedPanelStyle: CSSProperties = {
  ...panelStyle,
  borderColor: 'var(--border-accent-soft)',
  background: 'var(--surface-accent-card)',
};

export const insetPanelStyle: CSSProperties = {
  padding: 18,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-soft)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface-muted)',
};

export const cautionPanelStyle: CSSProperties = {
  ...panelStyle,
  borderColor: 'rgba(255, 153, 60, 0.26)',
  background: 'var(--surface-warning-card)',
};

export const errorPanelStyle: CSSProperties = {
  ...panelStyle,
  borderColor: 'rgba(255, 107, 74, 0.34)',
  background: 'var(--surface-error-card)',
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
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-soft)',
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
  padding: 18,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface-card)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-soft)',
  boxShadow: 'var(--shadow-card)',
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
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    fontWeight: 600,
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
  };

  if (kind === 'primary') {
    return {
      ...base,
      background: 'var(--button-primary-bg)',
      color: 'var(--button-primary-text)',
      borderColor: 'var(--button-primary-border)',
      boxShadow: disabled ? 'none' : '0 10px 24px rgba(0,0,0,0.12)',
    };
  }

  if (kind === 'danger') {
    return {
      ...base,
      background: 'var(--button-danger-bg)',
      borderColor: 'var(--button-danger-border)',
      color: 'var(--button-danger-text)',
    };
  }

  return {
    ...base,
    background: 'var(--button-secondary-bg)',
    borderColor: 'var(--button-secondary-border)',
    color: 'var(--button-secondary-text)',
  };
}

export const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  borderRadius: 'var(--radius-control)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-soft)',
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
    minHeight: 44,
    padding: '10px 16px',
    background: active ? 'var(--button-primary-bg)' : 'var(--surface-pill)',
    borderColor: active ? 'var(--button-primary-border)' : 'var(--border-soft)',
    color: active ? 'var(--button-primary-text)' : 'var(--text-secondary)',
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
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--border-soft)',
    background: 'var(--surface-muted)',
  };

  if (tone === 'accent') {
    return {
      ...style,
      borderColor: 'var(--border-accent-soft)',
      background: 'var(--surface-accent-card)',
    };
  }

  if (tone === 'warning') {
    return {
      ...style,
      borderColor: 'rgba(255, 153, 60, 0.26)',
      background: 'var(--surface-warning-card)',
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
