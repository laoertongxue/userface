import React from 'react';
import type { AnalyzeResponse } from '@/app/analyze/types';
import {
  cautionPanelStyle,
  itemCardStyle,
  listStyle,
  sectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type CaveatsPanelProps = {
  result: AnalyzeResponse;
};

function buildFallbackCaveats(result: AnalyzeResponse): string[] {
  const notes: string[] = [];
  const confidence = result.portrait?.confidence;
  const flags = result.cluster?.confidence?.flags ?? [];

  if (
    result.portrait?.archetype === 'insufficient-data' ||
    (result.portrait?.tags ?? []).includes('low-data')
  ) {
    notes.push('当前样本量有限，结论只反映已抓取到的公开活动。');
  }

  if ((result.warnings?.length ?? 0) > 0 || flags.includes('DEGRADED_SOURCE')) {
    notes.push('当前结果包含抓取降级或部分成功情形，建议结合 warnings 一起阅读。');
  }

  if (confidence !== undefined && confidence < 0.5) {
    notes.push('当前置信度偏低，适合把 narrative 与 structured facts 一起交叉验证。');
  }

  return [...new Set(notes)];
}

export function CaveatsPanel({ result }: CaveatsPanelProps) {
  const explicitCaveat = result.narrative?.caveats;
  const fallbackCaveats = explicitCaveat ? [] : buildFallbackCaveats(result);
  const warnings = result.warnings ?? [];
  const narrativeWarnings = result.narrative?.warnings ?? [];
  const hasContent =
    Boolean(explicitCaveat) ||
    fallbackCaveats.length > 0 ||
    warnings.length > 0 ||
    narrativeWarnings.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <section style={cautionPanelStyle}>
      <h2 style={sectionTitleStyle}>Caveats & Warnings</h2>
      {explicitCaveat && (
        <div style={{ ...itemCardStyle('warning'), marginBottom: warnings.length > 0 || narrativeWarnings.length > 0 ? 14 : 0 }}>
          <p style={{ margin: 0, lineHeight: 1.8, color: 'var(--text-primary)' }}>
            <strong>Caveat:</strong> {explicitCaveat}
          </p>
        </div>
      )}

      {!explicitCaveat && fallbackCaveats.length > 0 && (
        <div style={{ ...itemCardStyle('warning'), marginTop: 0 }}>
          <strong>保守提示</strong>
          <ul style={{ ...listStyle, marginTop: 8 }}>
            {fallbackCaveats.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ marginTop: explicitCaveat || fallbackCaveats.length > 0 ? 16 : 0 }}>
          <strong>Warnings</strong>
          <ul style={{ ...listStyle, marginTop: 8 }}>
            {warnings.map((warning, index) => (
              <li key={`${warning.code ?? 'warning'}-${index}`}>
                <strong>{warning.code ?? 'UNKNOWN_WARNING'}</strong>: {warning.message ?? 'No message'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrativeWarnings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Narrative Notes</strong>
          <ul style={{ ...listStyle, marginTop: 8, marginBottom: 0 }}>
            {narrativeWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
