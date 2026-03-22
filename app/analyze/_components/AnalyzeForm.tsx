'use client';

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import { AnalyzeResultPanel } from '@/app/analyze/_components/AnalyzeResultPanel';
import { SuggestionPanel } from '@/app/analyze/_components/SuggestionPanel';
import {
  buildAnalyzeRequest,
  buildSuggestRequest,
  createDefaultClusterDraft,
  createDraftAccount,
  dedupeDraftAccounts,
  getEffectiveAccounts,
  readClusterDraft,
  upsertSuggestionDecision,
  writeClusterDraft,
} from '@/app/analyze/_lib/clusterDraft';
import type {
  AnalyzeError,
  AnalyzeMode,
  AnalyzeResponse,
  ClusterDraft,
  DraftAccount,
  SuggestionDecisionStatus,
  SuggestionResponse,
  SupportedCommunity,
} from '@/app/analyze/types';

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';
type SuggestStatus = 'idle' | 'loading' | 'success' | 'error';

const communityMeta: Record<
  SupportedCommunity,
  {
    description: string;
    handleLabel: string;
    placeholder: string;
    title: string;
  }
> = {
  guozaoke: {
    description: '公开页面抓取，输入过早客用户 ID / handle。',
    handleLabel: '过早客用户 ID / handle',
    placeholder: '例如：sample-user',
    title: '过早客',
  },
  v2ex: {
    description: '公开接口 + 公开页面抓取，输入 V2EX 用户名。',
    handleLabel: 'V2EX 用户名',
    placeholder: '例如：Livid',
    title: 'V2EX',
  },
};

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

const fieldsetStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 0,
};

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

async function parseErrorResponse(response: Response): Promise<AnalyzeError> {
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; details?: unknown; message?: string };
    };

    return {
      code: payload.error?.code ?? 'REQUEST_FAILED',
      details: payload.error?.details,
      message: payload.error?.message ?? '请求失败，请稍后重试。',
    };
  } catch {
    return {
      code: 'REQUEST_FAILED',
      message: `请求失败，HTTP ${response.status}`,
    };
  }
}

function ensureAccountsForMode(mode: AnalyzeMode, accounts: DraftAccount[]): DraftAccount[] {
  if (mode === 'SINGLE_ACCOUNT') {
    return accounts.length > 0 ? accounts : [createDraftAccount()];
  }

  if (accounts.length >= 2) {
    return accounts;
  }

  if (accounts.length === 1) {
    const nextCommunity = accounts[0].community === 'v2ex' ? 'guozaoke' : 'v2ex';
    return [...accounts, createDraftAccount(nextCommunity)];
  }

  return [createDraftAccount('v2ex'), createDraftAccount('guozaoke')];
}

export function AnalyzeForm() {
  const [draft, setDraft] = useState<ClusterDraft>(createDefaultClusterDraft());
  const [isHydrated, setIsHydrated] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle');
  const [suggestStatus, setSuggestStatus] = useState<SuggestStatus>('idle');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<AnalyzeError | null>(null);
  const [suggestError, setSuggestError] = useState<AnalyzeError | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [lastSubmittedAccounts, setLastSubmittedAccounts] = useState<DraftAccount[]>([]);

  useEffect(() => {
    setDraft(
      readClusterDraft(typeof window !== 'undefined' ? window.localStorage : null),
    );
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writeClusterDraft(
      typeof window !== 'undefined' ? window.localStorage : null,
      draft,
    );
  }, [draft, isHydrated]);

  const singleAccount = draft.accounts[0] ?? createDraftAccount();
  const effectiveSingleAccounts = useMemo(
    () => getEffectiveAccounts('SINGLE_ACCOUNT', draft.accounts),
    [draft.accounts],
  );
  const effectiveClusterAccounts = useMemo(
    () => getEffectiveAccounts('MANUAL_CLUSTER', draft.accounts),
    [draft.accounts],
  );
  const canRequestSuggestions = effectiveClusterAccounts.length >= 2;

  function updateDraftAccounts(nextAccounts: DraftAccount[]) {
    setDraft((current) => ({
      ...current,
      accounts: nextAccounts,
    }));
  }

  function handleModeChange(nextMode: AnalyzeMode) {
    setDraft((current) => ({
      ...current,
      mode: nextMode,
      accounts: ensureAccountsForMode(nextMode, current.accounts),
    }));
    setAnalyzeStatus('idle');
    setSuggestStatus('idle');
    setAnalyzeError(null);
    setSuggestError(null);
    setResult(null);
    setSuggestionResult(null);
    setLocalMessage(
      nextMode === 'SINGLE_ACCOUNT'
        ? '已切换到单账号模式。若你之前录入了多个账号，它们仍保留在本地草稿中，切回聚合模式后可继续编辑。'
        : '已切换到手工聚合模式。当前草稿只保存在浏览器 localStorage，不会写入服务端。',
    );
  }

  function updateSingleAccount(next: Partial<DraftAccount>) {
    const first = draft.accounts[0] ?? createDraftAccount();
    const nextAccounts = [...draft.accounts];
    nextAccounts[0] = {
      ...first,
      ...next,
    };
    updateDraftAccounts(nextAccounts);
  }

  function updateClusterAccount(index: number, next: Partial<DraftAccount>) {
    const nextAccounts = [...draft.accounts];
    const current = nextAccounts[index] ?? createDraftAccount();
    nextAccounts[index] = {
      ...current,
      ...next,
    };
    updateDraftAccounts(nextAccounts);
  }

  function addClusterAccount() {
    updateDraftAccounts([
      ...draft.accounts,
      createDraftAccount(draft.accounts[draft.accounts.length - 1]?.community === 'v2ex' ? 'guozaoke' : 'v2ex'),
    ]);
  }

  function removeClusterAccount(index: number) {
    const nextAccounts = draft.accounts.filter((_, accountIndex) => accountIndex !== index);
    updateDraftAccounts(nextAccounts.length > 0 ? nextAccounts : [createDraftAccount()]);
  }

  function dedupeCurrentDraft() {
    const deduped = dedupeDraftAccounts(draft.accounts);
    const removedCount = Math.max(draft.accounts.length - deduped.length, 0);
    updateDraftAccounts(deduped.length > 0 ? deduped : [createDraftAccount()]);
    setLocalMessage(
      removedCount > 0
        ? `已清理 ${removedCount} 个重复账号。`
        : '当前草稿中没有可清理的重复账号。',
    );
  }

  function applySuggestionDecision(pairKey: string, status: SuggestionDecisionStatus) {
    setDraft((current) => ({
      ...current,
      suggestionDecisions: upsertSuggestionDecision(current.suggestionDecisions, pairKey, status),
    }));
  }

  async function handleSuggest() {
    const suggestRequest = buildSuggestRequest(draft.accounts);

    if (suggestRequest.accounts.length < 2) {
      setSuggestStatus('error');
      setSuggestError({
        code: 'INVALID_INPUT',
        message: '聚合模式下至少需要 2 个去重后的非空账号，才能请求关联建议。',
      });
      return;
    }

    setSuggestStatus('loading');
    setSuggestError(null);
    setLocalMessage(null);

    const dedupedAccounts = dedupeDraftAccounts(draft.accounts);
    if (dedupedAccounts.length !== draft.accounts.length) {
      updateDraftAccounts(dedupedAccounts);
      setLocalMessage('建议请求前已自动清理重复账号。');
    }

    try {
      const response = await fetch('/api/identity/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(suggestRequest),
      });

      if (!response.ok) {
        const parsedError = await parseErrorResponse(response);
        setSuggestStatus('error');
        setSuggestError(parsedError);
        return;
      }

      const payload = (await response.json()) as SuggestionResponse;
      setSuggestionResult(payload);
      setSuggestStatus('success');
      setDraft((current) => ({
        ...current,
        lastSuggestedAt: new Date().toISOString(),
      }));
    } catch {
      setSuggestStatus('error');
      setSuggestError({
        code: 'REQUEST_FAILED',
        message: '关联建议请求未完成，请检查本地服务或网络状态后重试。',
      });
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requestBody = buildAnalyzeRequest(draft.mode, draft.accounts);
    const effectiveAccounts = requestBody.identity.accounts;

    if (effectiveAccounts.length === 0) {
      setAnalyzeStatus('error');
      setResult(null);
      setAnalyzeError({
        code: 'INVALID_INPUT',
        message:
          draft.mode === 'SINGLE_ACCOUNT'
            ? `请输入一个非空的${communityMeta[singleAccount.community].handleLabel}。`
            : '请至少保留一个非空账号后再发起聚合分析。',
      });
      return;
    }

    const dedupedAccounts = dedupeDraftAccounts(draft.accounts);
    if (dedupedAccounts.length !== draft.accounts.length) {
      updateDraftAccounts(dedupedAccounts);
      setLocalMessage('分析请求前已自动清理重复账号。');
    } else if (draft.mode === 'MANUAL_CLUSTER' && effectiveAccounts.length === 1) {
      setLocalMessage('当前聚合草稿去重后只有 1 个账号，本次请求仍会作为合法分析继续执行。');
    } else {
      setLocalMessage(null);
    }

    setAnalyzeStatus('loading');
    setAnalyzeError(null);
    setResult(null);
    setLastSubmittedAccounts(
      effectiveAccounts.map((account) => ({
        community: account.community,
        handle: account.handle,
      })),
    );

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const parsedError = await parseErrorResponse(response);
        setAnalyzeStatus('error');
        setAnalyzeError(parsedError);
        return;
      }

      const payload = (await response.json()) as AnalyzeResponse;
      setResult(payload);
      setAnalyzeStatus('success');
      setDraft((current) => ({
        ...current,
        lastAnalyzedAt: new Date().toISOString(),
      }));
    } catch {
      setAnalyzeStatus('error');
      setAnalyzeError({
        code: 'REQUEST_FAILED',
        message: '分析请求未完成，请检查本地服务或网络状态后重试。',
      });
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>模式切换</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(['SINGLE_ACCOUNT', 'MANUAL_CLUSTER'] as AnalyzeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                border: `1px solid ${draft.mode === mode ? '#111827' : '#d1d5db'}`,
                background: draft.mode === mode ? '#f3f4f6' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              {mode === 'SINGLE_ACCOUNT' ? '单账号分析' : '手工聚合分析'}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.6, color: '#4b5563' }}>
          单账号模式继续沿用现有工作流。手工聚合模式允许你在浏览器里维护一个本地 cluster 草稿、请求关联建议，并直接对当前账号列表发起聚合分析。
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          {draft.mode === 'SINGLE_ACCOUNT' ? '单账号输入区' : '聚合草稿编辑区'}
        </h2>
        <form onSubmit={handleAnalyze} style={{ display: 'grid', gap: 16 }}>
          {draft.mode === 'SINGLE_ACCOUNT' ? (
            <>
              <fieldset style={fieldsetStyle}>
                <legend style={{ fontWeight: 600, marginBottom: 8 }}>分析平台</legend>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(Object.keys(communityMeta) as SupportedCommunity[]).map((item) => (
                    <label
                      key={item}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 999,
                        border: `1px solid ${singleAccount.community === item ? '#111827' : '#d1d5db'}`,
                        background: singleAccount.community === item ? '#f3f4f6' : '#ffffff',
                        cursor: analyzeStatus === 'loading' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="community"
                        value={item}
                        checked={singleAccount.community === item}
                        disabled={analyzeStatus === 'loading'}
                        onChange={() => updateSingleAccount({ community: item })}
                      />
                      <span>{communityMeta[item].title}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
                {communityMeta[singleAccount.community].description}
                {draft.accounts.length > 1 &&
                  ' 当前本地草稿里仍保留了其他聚合账号，切回手工聚合模式后可继续编辑。'}
              </p>

              <label htmlFor="single-account-handle" style={{ fontWeight: 600 }}>
                {communityMeta[singleAccount.community].handleLabel}
              </label>
              <input
                id="single-account-handle"
                name="handle"
                type="text"
                value={singleAccount.handle}
                onChange={(event) => updateSingleAccount({ handle: event.target.value })}
                placeholder={communityMeta[singleAccount.community].placeholder}
                disabled={analyzeStatus === 'loading'}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #9ca3af',
                  fontSize: 16,
                }}
              />
            </>
          ) : (
            <>
              <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
                当前 cluster 草稿只保存在浏览器 localStorage 中。suggestion 只用于本地确认，不会自动写入后端事实。
              </p>

              <div style={{ display: 'grid', gap: 12 }}>
                {draft.accounts.map((account, index) => (
                  <div
                    key={`${account.community}-${index}`}
                    style={{
                      display: 'grid',
                      gap: 8,
                      padding: 16,
                      borderRadius: 10,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <strong>账号 {index + 1}</strong>
                      <button
                        type="button"
                        onClick={() => removeClusterAccount(index)}
                        disabled={analyzeStatus === 'loading' || suggestStatus === 'loading'}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #dc2626',
                          background: '#ffffff',
                          color: '#dc2626',
                          cursor:
                            analyzeStatus === 'loading' || suggestStatus === 'loading'
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        删除
                      </button>
                    </div>
                    <label style={{ fontWeight: 600 }}>
                      社区
                      <select
                        value={account.community}
                        onChange={(event) =>
                          updateClusterAccount(index, {
                            community: event.target.value as SupportedCommunity,
                          })
                        }
                        disabled={analyzeStatus === 'loading' || suggestStatus === 'loading'}
                        style={{
                          display: 'block',
                          width: '100%',
                          marginTop: 6,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid #9ca3af',
                          fontSize: 16,
                        }}
                      >
                        <option value="v2ex">V2EX</option>
                        <option value="guozaoke">过早客</option>
                      </select>
                    </label>
                    <label style={{ fontWeight: 600 }}>
                      用户标识
                      <input
                        type="text"
                        value={account.handle}
                        onChange={(event) => updateClusterAccount(index, { handle: event.target.value })}
                        placeholder={communityMeta[account.community].placeholder}
                        disabled={analyzeStatus === 'loading' || suggestStatus === 'loading'}
                        style={{
                          display: 'block',
                          width: '100%',
                          marginTop: 6,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid #9ca3af',
                          fontSize: 16,
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={addClusterAccount}
                  disabled={analyzeStatus === 'loading' || suggestStatus === 'loading'}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #111827',
                    background: '#ffffff',
                    cursor:
                      analyzeStatus === 'loading' || suggestStatus === 'loading'
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  添加账号
                </button>
                <button
                  type="button"
                  onClick={dedupeCurrentDraft}
                  disabled={analyzeStatus === 'loading' || suggestStatus === 'loading'}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #6b7280',
                    background: '#ffffff',
                    cursor:
                      analyzeStatus === 'loading' || suggestStatus === 'loading'
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  清理重复账号
                </button>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#f3f4f6',
                  color: '#374151',
                  lineHeight: 1.7,
                }}
              >
                <strong>当前草稿概况</strong>
                <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                  <li>去重后账号数：{effectiveClusterAccounts.length}</li>
                  <li>上次建议时间：{formatTimestamp(draft.lastSuggestedAt)}</li>
                  <li>上次分析时间：{formatTimestamp(draft.lastAnalyzedAt)}</li>
                </ul>
              </div>
            </>
          )}

          <div>
            <button
              type="submit"
              disabled={analyzeStatus === 'loading'}
              style={{
                padding: '10px 16px',
                border: 0,
                borderRadius: 8,
                background: analyzeStatus === 'loading' ? '#9ca3af' : '#111827',
                color: '#ffffff',
                cursor: analyzeStatus === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              {analyzeStatus === 'loading'
                ? '分析中...'
                : draft.mode === 'SINGLE_ACCOUNT'
                  ? '开始分析'
                  : '开始聚合分析'}
            </button>
          </div>
        </form>
      </section>

      {draft.mode === 'MANUAL_CLUSTER' && (
        <SuggestionPanel
          decisionState={draft.suggestionDecisions}
          error={suggestError}
          loading={suggestStatus === 'loading'}
          onRequest={handleSuggest}
          onUpdateDecision={applySuggestionDecision}
          requestDisabled={!canRequestSuggestions || analyzeStatus === 'loading'}
          result={suggestionResult}
        />
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>工作流状态</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>草稿模式：{draft.mode}</li>
          <li>Suggestion 状态：{suggestStatus}</li>
          <li>Analyze 状态：{analyzeStatus}</li>
        </ul>
        {localMessage && (
          <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.6, color: '#374151' }}>
            {localMessage}
          </p>
        )}
      </section>

      {analyzeError && (
        <section
          style={{
            ...cardStyle,
            borderColor: '#dc2626',
            background: '#fef2f2',
          }}
        >
          <h2 style={sectionTitleStyle}>分析错误</h2>
          <p style={{ marginTop: 0 }}>
            <strong>Code:</strong> {analyzeError.code}
          </p>
          <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
            <strong>Message:</strong> {analyzeError.message}
          </p>
        </section>
      )}

      {!result && analyzeStatus !== 'loading' && !analyzeError && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>空态</h2>
          <p style={{ marginTop: 0, lineHeight: 1.6 }}>
            {draft.mode === 'SINGLE_ACCOUNT'
              ? '选择一个平台并输入一个用户标识后，可以继续做单账号分析。'
              : '在聚合模式下，可以先维护多个账号草稿、请求 suggestion，再直接对当前账号列表发起聚合分析。'}
          </p>
          <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
            成功返回后，页面会继续展示既有的 portrait / evidence / metrics / communityBreakdowns / warnings；如果 report 提供 cluster 字段，也会额外显示 stable traits、community-specific traits、overlap / divergence、cluster confidence 与 account coverage。
          </p>
        </section>
      )}

      {analyzeStatus === 'loading' && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>分析中</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            正在调用 <code>/api/analyze</code>。当前模式为{' '}
            <strong>{draft.mode}</strong>，请等待结果返回。
          </p>
        </section>
      )}

      {result && (
        <AnalyzeResultPanel
          mode={draft.mode}
          result={result}
          submittedAccounts={
            lastSubmittedAccounts.length > 0
              ? lastSubmittedAccounts
              : draft.mode === 'SINGLE_ACCOUNT'
                ? effectiveSingleAccounts
                : effectiveClusterAccounts
          }
        />
      )}
    </div>
  );
}
