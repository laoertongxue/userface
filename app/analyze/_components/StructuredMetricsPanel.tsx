import React from 'react';
import type { AnalyzeResponse } from '@/app/analyze/types';
import {
  formatValue,
  metricCardStyle,
  metricGridStyle,
  mutedTextStyle,
  panelStyle,
  sectionTitleStyle,
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
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Structured Metrics</h2>
      <p style={{ ...mutedTextStyle, marginBottom: 14 }}>
        这些指标保持结构化可读，作为 narrative 之外的直接事实锚点。
      </p>
      <div style={metricGridStyle}>
        {metricItems.map((item) => (
          <div key={item.key} style={metricCardStyle}>
            <div style={{ ...mutedTextStyle, fontSize: 13 }}>{item.label}</div>
            <strong style={{ fontSize: 20 }}>
              {formatValue(result.metrics?.[item.key])}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
