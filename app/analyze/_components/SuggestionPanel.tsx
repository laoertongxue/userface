'use client';

import type { CSSProperties } from 'react';
import { pairKeyForAccounts } from '@/app/analyze/_lib/clusterDraft';
import type {
  AnalyzeError,
  SuggestionDecision,
  SuggestionDecisionStatus,
  SuggestionResponse,
} from '@/app/analyze/types';

const cardStyle: CSSProperties = {
  padding: 20,
  border: '1px solid #d1d5db',
  borderRadius: 12,
  background: '#ffffff',
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 20,
};

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
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={sectionTitleStyle}>关联建议</h2>
          <p style={{ marginTop: 0, marginBottom: 0, color: '#4b5563', lineHeight: 1.6 }}>
            这里调用 <code>/api/identity/suggest</code> 获取账号对建议。接受或拒绝只会更新当前浏览器里的草稿状态，不会自动写入后端事实。
          </p>
        </div>
        <button
          type="button"
          disabled={requestDisabled || loading}
          onClick={onRequest}
          style={{
            padding: '10px 16px',
            border: 0,
            borderRadius: 8,
            background: requestDisabled || loading ? '#9ca3af' : '#111827',
            color: '#ffffff',
            cursor: requestDisabled || loading ? 'not-allowed' : 'pointer',
            minWidth: 120,
          }}
        >
          {loading ? '建议中...' : '获取关联建议'}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}
        >
          <strong>{error.code}</strong>: {error.message}
        </div>
      )}

      {!result && !loading && !error && (
        <p style={{ marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
          当前还没有 suggestion 结果。聚合模式下至少准备 2 个非空账号后，再请求关联建议。
        </p>
      )}

      {result && (
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          {warnings.length > 0 && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: '#fffbeb',
                border: '1px solid #fcd34d',
              }}
            >
              <strong>Suggestion Warnings</strong>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                {warnings.map((warning, index) => (
                  <li key={`${warning.code ?? 'warning'}-${index}`}>
                    <strong>{warning.code ?? 'UNKNOWN_WARNING'}</strong>: {warning.message ?? 'No message'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Suggestions</h3>
            {suggestions.length === 0 ? (
              <p style={{ margin: 0 }}>当前没有达到阈值的关联建议。</p>
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
                  const status = currentDecisionStatus(decisionKey, decisionState, suggestion.status ?? 'PENDING');

                  return (
                    <article
                      key={`${decisionKey}-${index}`}
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <p style={{ marginTop: 0 }}>
                        <strong>Accounts:</strong>{' '}
                        {accounts.length > 0
                          ? accounts
                              .map((account) => `${account.community ?? 'unknown'}:${account.handle ?? 'N/A'}`)
                              .join(' ↔ ')
                          : 'N/A'}
                      </p>
                      <p>
                        <strong>Confidence:</strong> {formatConfidence(suggestion.confidence)}
                      </p>
                      <p>
                        <strong>Reasons:</strong>{' '}
                        {suggestion.reasons?.length ? suggestion.reasons.join(', ') : 'N/A'}
                      </p>
                      {suggestion.sourceHint && (
                        <p style={{ lineHeight: 1.6 }}>
                          <strong>Hint:</strong> {suggestion.sourceHint}
                        </p>
                      )}
                      <p>
                        <strong>Status:</strong> {status}
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => onUpdateDecision(decisionKey, 'ACCEPTED')}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #16a34a',
                            background: status === 'ACCEPTED' ? '#dcfce7' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          接受建议
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateDecision(decisionKey, 'REJECTED')}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #dc2626',
                            background: status === 'REJECTED' ? '#fee2e2' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          拒绝建议
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateDecision(decisionKey, 'PENDING')}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #9ca3af',
                            background: status === 'PENDING' ? '#f3f4f6' : '#ffffff',
                            cursor: 'pointer',
                          }}
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
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                查看 inspected accounts / ignored pairs
              </summary>
              {(result.inspectedAccounts?.length ?? 0) > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Inspected Accounts</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                    {(result.inspectedAccounts ?? []).map((account, index) => (
                      <li key={`${account.community ?? 'unknown'}-${account.handle ?? index}`}>
                        {account.community ?? 'unknown'}:{account.handle ?? 'N/A'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ignoredPairs.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Ignored Pairs</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {ignoredPairs.map((pair, index) => (
                      <li key={`${pair.from?.community ?? 'unknown'}-${pair.to?.community ?? 'unknown'}-${index}`}>
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
