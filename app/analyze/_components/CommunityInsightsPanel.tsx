import React from 'react';
import type { AnalyzeResponse } from '@/app/analyze/types';
import {
  itemCardStyle,
  metricGridStyle,
  mutedTextStyle,
  panelStyle,
  pillBaseStyle,
  sectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type CommunityInsightsPanelProps = {
  result: AnalyzeResponse;
};

export function CommunityInsightsPanel({ result }: CommunityInsightsPanelProps) {
  const communityBreakdowns = result.communityBreakdowns ?? [];

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Community Breakdowns</h2>
      <p style={{ ...mutedTextStyle, marginBottom: 14 }}>
        这里继续保留每个社区视角下的兼容结构，便于和上面的 community-specific traits 对照阅读。
      </p>
      {communityBreakdowns.length === 0 ? (
        <p style={{ margin: 0 }}>当前没有可展示的 community breakdown。</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {communityBreakdowns.map((item, index) => (
            <article
              key={`${item.community ?? 'community'}-${item.handle ?? index}`}
              style={itemCardStyle()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 8,
                }}
              >
                <strong>
                  {item.community ?? 'N/A'} · {item.handle ?? 'N/A'}
                </strong>
                {(item.tags?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(item.tags ?? []).map((tag) => (
                      <span key={`${item.community}-${tag}`} style={pillBaseStyle}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.8 }}>
                {item.summary ?? 'N/A'}
              </p>
              <div style={metricGridStyle}>
                {Object.entries(item.metrics ?? {}).length === 0 ? (
                  <div style={{ ...mutedTextStyle }}>当前没有可展示的 metrics。</div>
                ) : (
                  Object.entries(item.metrics ?? {}).map(([key, value]) => (
                    <div
                      key={key}
                      style={itemCardStyle()}
                    >
                      <div style={{ ...mutedTextStyle, fontSize: 13 }}>{key}</div>
                      <strong>{value}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
