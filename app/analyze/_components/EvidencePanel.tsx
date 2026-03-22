import React from 'react';
import type { AnalyzeResponse } from '@/app/analyze/types';
import {
  formatDateTime,
  itemCardStyle,
  panelStyle,
  sectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type EvidencePanelProps = {
  result: AnalyzeResponse;
};

export function EvidencePanel({ result }: EvidencePanelProps) {
  const evidence = result.evidence ?? [];

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Evidence</h2>
      {evidence.length === 0 ? (
        <p style={{ margin: 0 }}>当前没有可展示的 evidence。</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {evidence.map((item, index) => (
            <article
              key={`${item.activityUrl ?? 'evidence'}-${index}`}
              style={itemCardStyle()}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 8,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{item.label ?? 'Representative evidence'}</strong>
                <span>{item.community ?? 'N/A'}</span>
                <span>{formatDateTime(item.publishedAt)}</span>
              </div>
              <p style={{ marginTop: 0, marginBottom: 10, lineHeight: 1.8 }}>
                {item.excerpt ?? 'N/A'}
              </p>
              <p style={{ marginBottom: 0 }}>
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
        </div>
      )}
    </section>
  );
}
