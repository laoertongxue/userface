import React from 'react';
import type { AnalyzeResponse } from '@/app/analyze/types';
import {
  formatDateTime,
  itemCardStyle,
  mutedTextStyle,
  panelStyle,
  sectionTitleStyle,
  subSectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type EvidencePanelProps = {
  result: AnalyzeResponse;
};

export function EvidencePanel({ result }: EvidencePanelProps) {
  const evidence = result.evidence ?? [];
  const primaryEvidence = evidence.slice(0, 4);
  const remainingEvidence = evidence.slice(4);

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Evidence</h2>
      <p style={{ ...mutedTextStyle, marginBottom: 14 }}>
        这里保留支撑结论的代表性活动，不让 narrative 替代原始事实。
      </p>
      {evidence.length === 0 ? (
        <p style={{ margin: 0 }}>当前没有可展示的 evidence。</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {primaryEvidence.map((item, index) => (
            <article key={`${item.activityUrl ?? 'evidence'}-${index}`} style={itemCardStyle()}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                <div>
                  <div style={subSectionTitleStyle}>Evidence</div>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {item.label ?? 'Representative evidence'}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--surface-pill)' }}>
                    {item.community ?? 'N/A'}
                  </span>
                  <span>{formatDateTime(item.publishedAt)}</span>
                </div>
              </div>
              <p style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.82 }}>
                {item.excerpt ?? 'N/A'}
              </p>
              <p style={{ marginBottom: 0, fontWeight: 600 }}>
                {item.activityUrl ? (
                  <a href={item.activityUrl} target="_blank" rel="noreferrer">
                    打开原始活动
                  </a>
                ) : (
                  '当前没有 activity URL'
                )}
              </p>
            </article>
          ))}

          {remainingEvidence.length > 0 && (
            <details style={itemCardStyle()}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                查看其余 {remainingEvidence.length} 条 evidence
              </summary>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {remainingEvidence.map((item, index) => (
                  <article
                    key={`${item.activityUrl ?? 'evidence'}-rest-${index}`}
                    style={itemCardStyle()}
                  >
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {item.label ?? 'Representative evidence'}
                      </strong>
                      <span>{item.community ?? 'N/A'}</span>
                      <span>{formatDateTime(item.publishedAt)}</span>
                    </div>
                    <p style={{ marginTop: 0, marginBottom: 10, lineHeight: 1.8 }}>
                      {item.excerpt ?? 'N/A'}
                    </p>
                  </article>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
