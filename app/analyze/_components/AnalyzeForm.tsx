'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
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
import {
  buttonStyle,
  emphasizedPanelStyle,
  errorPanelStyle,
  infoGridStyle,
  inputStyle,
  insetPanelStyle,
  itemCardStyle,
  mutedTextStyle,
  panelStyle,
  sectionTitleStyle,
  segmentedButtonStyle,
  selectStyle,
  subtleTextStyle,
  subSectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

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

const fieldsetStyle = {
  margin: 0,
  padding: 0,
  border: 0,
} as const;

const labelStyle = {
  display: 'grid',
  gap: 8,
  fontWeight: 600,
  color: 'var(--text-primary)',
} as const;

const metaValueStyle = {
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: '-0.03em',
} as const;

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

function statusTone(status: AnalyzeStatus | SuggestStatus): 'default' | 'accent' | 'warning' {
  if (status === 'success') {
    return 'accent';
  }

  if (status === 'error') {
    return 'warning';
  }

  return 'default';
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
  const isBusy = analyzeStatus === 'loading' || suggestStatus === 'loading';

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
        ? '已切换到单账号模式。之前录入的聚合草稿仍会保留在本地，可随时切回继续编辑。'
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
      createDraftAccount(
        draft.accounts[draft.accounts.length - 1]?.community === 'v2ex'
          ? 'guozaoke'
          : 'v2ex',
      ),
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
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gap: 22,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'start',
        }}
      >
        <section style={panelStyle}>
          <p style={subSectionTitleStyle}>
            {draft.mode === 'SINGLE_ACCOUNT' ? 'Single Account Input' : 'Manual Cluster Builder'}
          </p>
          <h2 style={sectionTitleStyle}>
            {draft.mode === 'SINGLE_ACCOUNT' ? '输入一个账号开始分析' : '配置一个本地聚合分析主体'}
          </h2>
          <p style={{ ...mutedTextStyle, marginBottom: 18 }}>
            {draft.mode === 'SINGLE_ACCOUNT'
              ? '直接输入公开账号，快速生成结构化画像与 narrative 摘要。'
              : '在本地维护 cluster 草稿、审阅 suggestion，再把当前账号集合送入聚合分析。'}
          </p>

          <form onSubmit={handleAnalyze} style={{ display: 'grid', gap: 18 }}>
          {draft.mode === 'SINGLE_ACCOUNT' ? (
            <>
              <fieldset style={fieldsetStyle}>
                <legend style={{ ...subSectionTitleStyle, marginBottom: 10 }}>Community</legend>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(Object.keys(communityMeta) as SupportedCommunity[]).map((item) => (
                    <label
                      key={item}
                      style={{
                        ...segmentedButtonStyle(singleAccount.community === item, analyzeStatus === 'loading'),
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
                        style={{ display: 'none' }}
                      />
                      {communityMeta[item].title}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div style={insetPanelStyle}>
                <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Public Source Hint</p>
                <p style={mutedTextStyle}>
                  {communityMeta[singleAccount.community].description}
                  {draft.accounts.length > 1
                    ? ' 当前本地仍保留聚合草稿账号，切回手工聚合模式后可继续编辑。'
                    : ''}
                </p>
              </div>

              <label htmlFor="single-account-handle" style={labelStyle}>
                <span>{communityMeta[singleAccount.community].handleLabel}</span>
                <input
                  id="single-account-handle"
                  name="handle"
                  type="text"
                  value={singleAccount.handle}
                  onChange={(event) => updateSingleAccount({ handle: event.target.value })}
                  placeholder={communityMeta[singleAccount.community].placeholder}
                  disabled={analyzeStatus === 'loading'}
                  style={inputStyle}
                />
              </label>
            </>
          ) : (
            <>
              <div style={insetPanelStyle}>
                <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Local Draft</p>
                <p style={mutedTextStyle}>
                  这个 cluster 草稿只保存在当前浏览器的 localStorage 中。suggestion 仅用于帮助你理解和确认账号关系，不会自动写入后端事实。
                </p>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {draft.accounts.map((account, index) => (
                  <div
                    key={`${account.community}-${index}`}
                    style={itemCardStyle(index === 0 ? 'accent' : 'default')}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div style={subSectionTitleStyle}>Account {index + 1}</div>
                        <strong style={{ fontSize: 18 }}>
                          {account.community}:{account.handle || '未填写'}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeClusterAccount(index)}
                        disabled={isBusy}
                        style={buttonStyle('danger', isBusy)}
                      >
                        删除账号
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: 14,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      <label style={labelStyle}>
                        <span>社区</span>
                        <select
                          value={account.community}
                          onChange={(event) =>
                            updateClusterAccount(index, {
                              community: event.target.value as SupportedCommunity,
                            })
                          }
                          disabled={isBusy}
                          style={selectStyle}
                        >
                          <option value="v2ex">V2EX</option>
                          <option value="guozaoke">过早客</option>
                        </select>
                      </label>

                      <label style={labelStyle}>
                        <span>用户标识</span>
                        <input
                          type="text"
                          value={account.handle}
                          onChange={(event) =>
                            updateClusterAccount(index, { handle: event.target.value })
                          }
                          placeholder={communityMeta[account.community].placeholder}
                          disabled={isBusy}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={addClusterAccount}
                  disabled={isBusy}
                  style={buttonStyle('secondary', isBusy)}
                >
                  添加账号
                </button>
                <button
                  type="button"
                  onClick={dedupeCurrentDraft}
                  disabled={isBusy}
                  style={buttonStyle('secondary', isBusy)}
                >
                  清理重复账号
                </button>
              </div>

              <div style={infoGridStyle}>
                <div style={itemCardStyle('accent')}>
                  <div style={subSectionTitleStyle}>去重后账号数</div>
                  <div style={metaValueStyle}>{effectiveClusterAccounts.length}</div>
                </div>
                <div style={itemCardStyle()}>
                  <div style={subSectionTitleStyle}>上次建议时间</div>
                  <div style={{ ...mutedTextStyle, fontSize: 14 }}>
                    {formatTimestamp(draft.lastSuggestedAt)}
                  </div>
                </div>
                <div style={itemCardStyle()}>
                  <div style={subSectionTitleStyle}>上次分析时间</div>
                  <div style={{ ...mutedTextStyle, fontSize: 14 }}>
                    {formatTimestamp(draft.lastAnalyzedAt)}
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={analyzeStatus === 'loading'}
              style={buttonStyle('primary', analyzeStatus === 'loading')}
            >
              {analyzeStatus === 'loading'
                ? '分析中...'
                : draft.mode === 'SINGLE_ACCOUNT'
                  ? '开始分析'
                  : '开始聚合分析'}
            </button>
            <span style={{ ...subtleTextStyle, alignSelf: 'center' }}>
              {draft.mode === 'SINGLE_ACCOUNT'
                ? '单账号模式会直接提交一个账号到 /api/analyze。'
                : '聚合模式会把当前去重后的 accounts[] 直接作为 cluster 输入提交。'}
            </span>
          </div>
          </form>
        </section>

        <div style={{ display: 'grid', gap: 22 }}>
          <section style={emphasizedPanelStyle}>
            <p style={subSectionTitleStyle}>Mode Switch</p>
            <h2 style={sectionTitleStyle}>分析模式</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {(['SINGLE_ACCOUNT', 'MANUAL_CLUSTER'] as AnalyzeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  style={segmentedButtonStyle(draft.mode === mode, isBusy)}
                >
                  {mode === 'SINGLE_ACCOUNT' ? '单账号分析' : '手工聚合分析'}
                </button>
              ))}
            </div>
            <p style={mutedTextStyle}>
              单账号模式适合直接查看一个公开账号的画像。手工聚合模式会把多个账号草稿当作一个本地 cluster，支持 suggestion 审阅与 cluster-aware 结果阅读。
            </p>
          </section>

          <section style={panelStyle}>
            <p style={subSectionTitleStyle}>Workflow Status</p>
            <h2 style={sectionTitleStyle}>当前工作流状态</h2>
            <div style={infoGridStyle}>
              <div style={itemCardStyle(draft.mode === 'MANUAL_CLUSTER' ? 'accent' : 'default')}>
                <div style={subSectionTitleStyle}>草稿模式</div>
                <div style={metaValueStyle}>
                  {draft.mode === 'MANUAL_CLUSTER' ? '聚合' : '单账号'}
                </div>
              </div>
              <div style={itemCardStyle(statusTone(suggestStatus))}>
                <div style={subSectionTitleStyle}>Suggestion</div>
                <div style={metaValueStyle}>{suggestStatus}</div>
              </div>
              <div style={itemCardStyle(statusTone(analyzeStatus))}>
                <div style={subSectionTitleStyle}>Analyze</div>
                <div style={metaValueStyle}>{analyzeStatus}</div>
              </div>
            </div>
            {localMessage && (
              <div style={{ ...insetPanelStyle, marginTop: 16 }}>
                <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>Local Note</p>
                <p style={mutedTextStyle}>{localMessage}</p>
              </div>
            )}
          </section>
        </div>
      </div>

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

      {analyzeError && (
        <section style={errorPanelStyle}>
          <p style={subSectionTitleStyle}>Analyze Error</p>
          <h2 style={sectionTitleStyle}>分析请求未完成</h2>
          <p style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            <strong>Code:</strong> {analyzeError.code}
          </p>
          <p style={{ marginBottom: 0, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <strong>Message:</strong> {analyzeError.message}
          </p>
        </section>
      )}

      {!result && analyzeStatus !== 'loading' && !analyzeError && (
        <section style={panelStyle}>
          <p style={subSectionTitleStyle}>Empty State</p>
          <h2 style={sectionTitleStyle}>还没有分析结果</h2>
          <p style={mutedTextStyle}>
            {draft.mode === 'SINGLE_ACCOUNT'
              ? '先选择社区并输入一个公开账号，再发起分析。'
              : '先维护一个本地 cluster 草稿，可选地请求 suggestion，然后直接发起聚合分析。'}
          </p>
          <div style={{ ...insetPanelStyle, marginTop: 16 }}>
            <p style={{ ...subSectionTitleStyle, marginBottom: 8 }}>结果将会包含</p>
            <p style={mutedTextStyle}>
              headline、summary、archetype、tags、confidence、warnings、evidence、metrics、community breakdowns，以及在可用时的 cluster traits、coverage 与 overlap/divergence。
            </p>
          </div>
        </section>
      )}

      {analyzeStatus === 'loading' && (
        <section style={emphasizedPanelStyle}>
          <p style={subSectionTitleStyle}>Loading State</p>
          <h2 style={sectionTitleStyle}>正在生成分析结果</h2>
          <p style={mutedTextStyle}>
            正在调用 <code>/api/analyze</code>。当前模式为{' '}
            <strong>{draft.mode}</strong>，请等待 portrait、evidence、metrics 与 narrative 一起返回。
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
