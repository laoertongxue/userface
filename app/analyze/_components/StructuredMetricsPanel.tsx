import React from 'react';
import type { AnalyzeResponse } from '@/app/analyze/types';
import {
  formatValue,
  metricCardStyle,
  metricGridStyle,
  mutedTextStyle,
  sectionTitleStyle,
  subSectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type StructuredMetricsPanelProps = {
  result: AnalyzeResponse;
};

const metricItems = [
  { key: 'totalActivities', label: 'Total Activities' },
  { key: 'topicCount', label: 'Topic Count' },
  { key: 'replyCount', label: 'Reply Count' },
  { key: 'avgTextLength', label: 'Avg Text Length' },
  { key: 'activeDays', label: 'Active Days' },
] as const;

export function StructuredMetricsPanel({ result }: StructuredMetricsPanelProps) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div>
        <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Analysis Overview</p>
        <h2 style={{ ...sectionTitleStyle, marginBottom: 6 }}>Structured Metrics</h2>
        <p style={mutedTextStyle}>这些指标继续作为 narrative 之外的直接事实锚点。</p>
      </div>
      <div style={metricGridStyle}>
        {metricItems.map((item) => (
          <div key={item.key} style={metricCardStyle}>
            <div style={{ ...mutedTextStyle, fontSize: 13, marginBottom: 10 }}>{item.label}</div>
            <strong style={{ fontSize: 22, letterSpacing: '-0.05em' }}>
              {formatValue(result.metrics?.[item.key])}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
