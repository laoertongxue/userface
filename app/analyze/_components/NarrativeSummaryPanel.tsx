import React, { type CSSProperties } from 'react';
import type { AnalyzeMode, AnalyzeResponse, DraftAccount } from '@/app/analyze/types';
import {
  formatConfidence,
  insetPanelStyle,
  pillBaseStyle,
  subSectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type NarrativeSummaryPanelProps = {
  mode: AnalyzeMode;
  result: AnalyzeResponse;
  submittedAccounts: DraftAccount[];
};

function isLowData(result: AnalyzeResponse): boolean {
  return (
    result.portrait?.archetype === 'insufficient-data' ||
    (result.portrait?.tags ?? []).includes('low-data') ||
    (result.cluster?.confidence?.flags ?? []).includes('LOW_ACTIVITY_VOLUME')
  );
}

function hasDegradedSignal(result: AnalyzeResponse): boolean {
  return (
    (result.warnings?.length ?? 0) > 0 ||
    (result.cluster?.confidence?.flags ?? []).includes('DEGRADED_SOURCE')
  );
}

function badgeStyle(kind: 'neutral' | 'warning' | 'success'): CSSProperties {
  if (kind === 'warning') {
    return {
      ...pillBaseStyle,
      borderColor: 'rgba(255, 153, 60, 0.28)',
      background: 'rgba(255, 153, 60, 0.14)',
      color: 'var(--accent)',
    };
  }

  if (kind === 'success') {
    return {
      ...pillBaseStyle,
      borderColor: 'var(--border-accent-soft)',
      background: 'rgba(255, 154, 60, 0.16)',
      color: 'var(--accent)',
    };
  }

  return pillBaseStyle;
}

export function NarrativeSummaryPanel({
  mode,
  result,
  submittedAccounts,
}: NarrativeSummaryPanelProps) {
  const headline = result.narrative?.headline;
  const shortSummary = result.narrative?.shortSummary ?? result.portrait?.summary ?? 'N/A';
  const deepSummary = result.narrative?.deepSummary;
  const portraitConfidence = result.portrait?.confidence;
  const clusterConfidence = result.cluster?.confidence?.overall;
  const topTags = result.portrait?.tags ?? [];
  const caveatTeaser = result.narrative?.caveats;
  const lowData = isLowData(result);
  const degraded = hasDegradedSignal(result);
  const summaryCardStyle: CSSProperties = {
    padding: '30px 28px',
    borderRadius: 30,
    border: '1px solid rgba(255,255,255,0.08)',
    background:
      'radial-gradient(circle at 100% 0%, rgba(242,162,90,0.08), transparent 22%), linear-gradient(180deg, #191919 0%, #111111 100%)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.2)',
    color: '#f6f2ea',
  };

  return (
    <section style={summaryCardStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span style={badgeStyle('neutral')}>
          {mode === 'MANUAL_CLUSTER' ? '聚合分析' : '单账号分析'}
        </span>
        <span style={badgeStyle('neutral')}>
          {submittedAccounts.length} 个提交账号
        </span>
        {result.narrative && (
          <span
            style={badgeStyle(
              result.narrative.generatedBy === 'LLM_ASSISTED' ? 'success' : 'neutral',
            )}
          >
            Narrative: {result.narrative.generatedBy}
            {result.narrative.fallbackUsed ? ' (fallback)' : ''}
          </span>
        )}
        {lowData && <span style={badgeStyle('warning')}>样本有限</span>}
        {degraded && <span style={badgeStyle('warning')}>需谨慎解读</span>}
      </div>

      {headline && (
        <h2
          style={{
            marginTop: 0,
            marginBottom: 12,
            fontSize: 40,
            lineHeight: 1.02,
            letterSpacing: '-0.065em',
            maxWidth: '16ch',
            color: '#f6f2ea',
          }}
        >
          {headline}
        </h2>
      )}

      <p
        style={{
          marginTop: 0,
          marginBottom: 18,
          fontSize: 16,
          lineHeight: 1.84,
          color: 'rgba(246,242,234,0.88)',
          maxWidth: '62ch',
        }}
      >
        {shortSummary}
      </p>

      {(topTags.length > 0 || result.portrait?.archetype || portraitConfidence !== undefined) && (
        <div
          style={{
            display: 'grid',
            gap: 14,
            marginBottom: 16,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <div style={insetPanelStyle}>
              <div style={{ ...subSectionTitleStyle, marginBottom: 6, color: '#8d867f' }}>Archetype</div>
              <strong style={{ fontSize: 18, color: '#111111' }}>{result.portrait?.archetype ?? 'N/A'}</strong>
            </div>
            <div style={insetPanelStyle}>
              <div style={{ ...subSectionTitleStyle, marginBottom: 6, color: '#8d867f' }}>Portrait Confidence</div>
              <strong style={{ fontSize: 18, color: '#111111' }}>{formatConfidence(portraitConfidence)}</strong>
            </div>
            {clusterConfidence !== undefined && mode === 'MANUAL_CLUSTER' && (
              <div style={insetPanelStyle}>
                <div style={{ ...subSectionTitleStyle, marginBottom: 6, color: '#8d867f' }}>Cluster Confidence</div>
                <strong style={{ fontSize: 18, color: '#111111' }}>{formatConfidence(clusterConfidence)}</strong>
              </div>
            )}
          </div>
          {topTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {topTags.map((tag) => (
                <span key={tag} style={pillBaseStyle}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 14, color: 'rgba(246,242,234,0.62)', lineHeight: 1.7 }}>
        提交账号：{' '}
        {submittedAccounts.map((account) => `${account.community}:${account.handle}`).join('，') || 'N/A'}
      </p>

      {caveatTeaser && (
        <div
          style={{
            ...insetPanelStyle,
            marginTop: 14,
            borderColor: 'rgba(242,162,90,0.22)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(246,242,234,0.8)',
            lineHeight: 1.75,
          }}
        >
          <strong>谨慎提示：</strong> {caveatTeaser}
        </div>
      )}

      {deepSummary && deepSummary !== shortSummary && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#f6f2ea' }}>
            查看详细叙事摘要
          </summary>
          <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.8, color: 'rgba(246,242,234,0.84)' }}>
            {deepSummary}
          </p>
        </details>
      )}
    </section>
  );
}
