'use client';

import React from 'react';
import { pairKeyForAccounts } from '@/app/analyze/_lib/clusterDraft';
import type {
  AnalyzeError,
  SuggestionDecision,
  SuggestionDecisionStatus,
  SuggestionResponse,
} from '@/app/analyze/types';
import {
  buttonStyle,
  errorPanelStyle,
  insetPanelStyle,
  itemCardStyle,
  mutedTextStyle,
  panelStyle,
  pillBaseStyle,
  sectionTitleStyle,
  subSectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

function formatConfidence(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }

  return `${Math.round(value * 100)}%`;
}

function currentDecisionStatus(
  pairKey: string,
  decisions: SuggestionDecision[],
  fallback: SuggestionDecisionStatus = 'PENDING',
): SuggestionDecisionStatus {
  return decisions.find((decision) => decision.pairKey === pairKey)?.status ?? fallback;
}

function suggestionStatusPill(status: SuggestionDecisionStatus) {
  if (status === 'ACCEPTED') {
    return {
      ...pillBaseStyle,
      borderColor: 'var(--border-accent-soft)',
      background: 'rgba(255,154,60,0.16)',
      color: 'var(--accent)',
    };
  }

  if (status === 'REJECTED') {
    return {
      ...pillBaseStyle,
      borderColor: 'rgba(255,107,74,0.28)',
      background: 'rgba(255,107,74,0.12)',
      color: '#ffd7cc',
    };
  }

  return pillBaseStyle;
}

type SuggestionPanelProps = {
  decisionState: SuggestionDecision[];
  error: AnalyzeError | null;
  loading: boolean;
  onRequest: () => void;
  onUpdateDecision: (pairKey: string, status: SuggestionDecisionStatus) => void;
  requestDisabled: boolean;
  result: SuggestionResponse | null;
};

export function SuggestionPanel({
  decisionState,
  error,
  loading,
  onRequest,
  onUpdateDecision,
  requestDisabled,
  result,
}: SuggestionPanelProps) {
  const suggestions = result?.suggestions ?? [];
  const ignoredPairs = result?.ignoredPairs ?? [];
  const warnings = result?.warnings ?? [];

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 18,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <p style={subSectionTitleStyle}>Suggestion Review</p>
          <h2 style={sectionTitleStyle}>关联建议审阅</h2>
          <p style={mutedTextStyle}>
            这里调用 <code>/api/identity/suggest</code> 获取账号对建议。接受或拒绝只会更新当前浏览器中的草稿状态，不会自动合并账号，也不会写入后端事实。
          </p>
        </div>
        <button
          type="button"
          disabled={requestDisabled || loading}
          onClick={onRequest}
          style={buttonStyle('primary', requestDisabled || loading)}
        >
          {loading ? '建议中...' : '获取关联建议'}
        </button>
      </div>

      <div style={{ ...insetPanelStyle, marginTop: 18 }}>
        <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Review Rule</p>
        <p style={mutedTextStyle}>
          这里只帮助你确认“哪些账号看起来可能属于同一主体”。接受或拒绝只改变本地草稿的审阅状态；真正提交到
          <code>/api/analyze</code> 的仍然只是当前 accounts 列表。
        </p>
      </div>

      {error && (
        <div style={{ ...errorPanelStyle, marginTop: 18 }}>
          <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Suggestion Error</p>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            <strong>{error.code}</strong>: {error.message}
          </p>
        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ ...insetPanelStyle, marginTop: 18 }}>
          <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Empty State</p>
          <p style={mutedTextStyle}>
            当前还没有 suggestion 结果。聚合模式下至少准备 2 个去重后的非空账号后，再请求关联建议。
          </p>
        </div>
      )}

      {result && (
        <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
          {warnings.length > 0 && (
            <div style={insetPanelStyle}>
              <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Suggestion Warnings</p>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                {warnings.map((warning, index) => (
                  <li key={`${warning.code ?? 'warning'}-${index}`}>
                    <strong>{warning.code ?? 'UNKNOWN_WARNING'}</strong>: {warning.message ?? 'No message'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p style={subSectionTitleStyle}>Suggestions</p>
            {suggestions.length === 0 ? (
              <div style={insetPanelStyle}>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  当前没有达到阈值的关联建议。
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {suggestions.map((suggestion, index) => {
                  const accounts = suggestion.candidateAccounts ?? [];
                  const decisionKey = pairKeyForAccounts(
                    accounts.map((account) => ({
                      community: account.community ?? 'unknown',
                      handle: account.handle ?? '',
                    })),
                  );
                  const status = currentDecisionStatus(
                    decisionKey,
                    decisionState,
                    suggestion.status ?? 'PENDING',
                  );

                  return (
                    <article
                      key={`${decisionKey}-${index}`}
                      style={itemCardStyle(status === 'ACCEPTED' ? 'accent' : 'default')}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div style={subSectionTitleStyle}>Candidate Pair</div>
                          <strong style={{ fontSize: 16 }}>
                            {accounts.length > 0
                              ? accounts
                                  .map(
                                    (account) =>
                                      `${account.community ?? 'unknown'}:${account.handle ?? 'N/A'}`,
                                  )
                                  .join(' ↔ ')
                              : 'N/A'}
                          </strong>
                        </div>
                        <span style={suggestionStatusPill(status)}>{status}</span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gap: 12,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          marginBottom: 12,
                        }}
                      >
                        <div style={insetPanelStyle}>
                          <div style={subSectionTitleStyle}>Confidence</div>
                          <strong style={{ fontSize: 22 }}>{formatConfidence(suggestion.confidence)}</strong>
                        </div>
                        <div style={insetPanelStyle}>
                          <div style={subSectionTitleStyle}>Reasons</div>
                          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                            {suggestion.reasons?.length ? suggestion.reasons.join(', ') : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {suggestion.sourceHint && (
                        <p style={{ ...mutedTextStyle, marginBottom: 12 }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Hint:</strong>{' '}
                          {suggestion.sourceHint}
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => onUpdateDecision(decisionKey, 'ACCEPTED')}
                          style={buttonStyle('primary', false)}
                        >
                          接受建议
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateDecision(decisionKey, 'REJECTED')}
                          style={buttonStyle('danger', false)}
                        >
                          拒绝建议
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateDecision(decisionKey, 'PENDING')}
                          style={buttonStyle('secondary', false)}
                        >
                          恢复待定
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {(ignoredPairs.length > 0 || (result.inspectedAccounts?.length ?? 0) > 0) && (
            <details style={{ ...insetPanelStyle, paddingBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                查看 inspected accounts / ignored pairs
              </summary>

              {(result.inspectedAccounts?.length ?? 0) > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Inspected Accounts</p>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                    {(result.inspectedAccounts ?? []).map((account, index) => (
                      <li key={`${account.community ?? 'unknown'}-${account.handle ?? index}`}>
                        {account.community ?? 'unknown'}:{account.handle ?? 'N/A'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ignoredPairs.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Ignored Pairs</p>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                    {ignoredPairs.map((pair, index) => (
                      <li
                        key={`${pair.from?.community ?? 'unknown'}-${pair.to?.community ?? 'unknown'}-${index}`}
                      >
                        {(pair.from?.community ?? 'unknown')}:{pair.from?.handle ?? 'N/A'} ↔{' '}
                        {(pair.to?.community ?? 'unknown')}:{pair.to?.handle ?? 'N/A'}{' '}
                        ({pair.reason ?? 'unknown'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
