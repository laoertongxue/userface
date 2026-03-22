'use client';

import { CSSProperties, FormEvent, useState } from 'react';

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';
type SupportedCommunity = 'v2ex' | 'guozaoke';

type AnalyzeResult = {
  communityBreakdowns?: Array<{
    community?: string;
    handle?: string;
    metrics?: Record<string, number>;
    summary?: string;
    tags?: string[];
  }>;
  evidence?: Array<{
    activityUrl?: string;
    community?: string;
    excerpt?: string;
    label?: string;
    publishedAt?: string;
  }>;
  metrics?: {
    activeDays?: number;
    avgTextLength?: number;
    replyCount?: number;
    topicCount?: number;
    totalActivities?: number;
  };
  portrait?: {
    archetype?: string;
    confidence?: number;
    summary?: string;
    tags?: string[];
  };
  warnings?: Array<{
    code?: string;
    message?: string;
  }>;
};

type AnalyzeError = {
  code: string;
  details?: unknown;
  message: string;
};

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

function formatValue(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return 'N/A';
  }

  return String(value);
}

function formatConfidence(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }

  return `${Math.round(value * 100)}%`;
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

export function AnalyzeForm() {
  const [community, setCommunity] = useState<SupportedCommunity>('v2ex');
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<{
    community: SupportedCommunity;
    handle: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedHandle = handle.trim();
    if (!normalizedHandle) {
      setStatus('error');
      setResult(null);
      setError({
        code: 'INVALID_INPUT',
        message: `请输入一个非空的${communityMeta[community].handleLabel}。`,
      });
      return;
    }

    setStatus('loading');
    setError(null);
    setResult(null);
    setLastSubmitted({
      community,
      handle: normalizedHandle,
    });

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: {
            accounts: [
              {
                community,
                handle: normalizedHandle,
              },
            ],
          },
          options: {
            locale: 'zh-CN',
          },
        }),
      });

      if (!response.ok) {
        const parsedError = await parseErrorResponse(response);
        setStatus('error');
        setError(parsedError);
        return;
      }

      const payload = (await response.json()) as AnalyzeResult;
      setResult(payload);
      setStatus('success');
    } catch {
      setStatus('error');
      setError({
        code: 'REQUEST_FAILED',
        message: '请求未完成，请检查本地服务或网络状态后重试。',
      });
    }
  }

  const warnings = result?.warnings ?? [];
  const evidence = result?.evidence ?? [];
  const communityBreakdowns = result?.communityBreakdowns ?? [];
  const selectedCommunityMeta = communityMeta[community];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>输入区</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
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
                    border: `1px solid ${community === item ? '#111827' : '#d1d5db'}`,
                    background: community === item ? '#f3f4f6' : '#ffffff',
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="community"
                    value={item}
                    checked={community === item}
                    disabled={status === 'loading'}
                    onChange={() => {
                      setCommunity(item);
                      setStatus('idle');
                      setError(null);
                      setResult(null);
                      setLastSubmitted(null);
                    }}
                  />
                  <span>{communityMeta[item].title}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
            {selectedCommunityMeta.description}
            切换平台会清空上一次分析结果与错误状态。
          </p>
          <label htmlFor="community-handle" style={{ fontWeight: 600 }}>
            {selectedCommunityMeta.handleLabel}
          </label>
          <input
            id="community-handle"
            name="handle"
            type="text"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder={selectedCommunityMeta.placeholder}
            disabled={status === 'loading'}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #9ca3af',
              fontSize: 16,
            }}
          />
          <div>
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                padding: '10px 16px',
                border: 0,
                borderRadius: 8,
                background: status === 'loading' ? '#9ca3af' : '#111827',
                color: '#ffffff',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'loading' ? '分析中...' : '开始分析'}
            </button>
          </div>
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>请求状态</h2>
        {status === 'idle' && (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            还没有发起分析。选择一个平台并输入对应用户标识后，点击“开始分析”。
          </p>
        )}
        {status === 'loading' && (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            正在调用 <code>/api/analyze</code>，当前平台为{' '}
            <strong>{communityMeta[lastSubmitted?.community ?? community].title}</strong>，请等待结果返回。
          </p>
        )}
        {status === 'success' && (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            分析完成，结果已更新到下方各区域。
          </p>
        )}
        {status === 'error' && (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            分析未完成，请查看下方错误信息。
          </p>
        )}
      </section>

      {error && (
        <section
          style={{
            ...cardStyle,
            borderColor: '#dc2626',
            background: '#fef2f2',
          }}
        >
          <h2 style={sectionTitleStyle}>错误信息</h2>
          <p style={{ marginTop: 0 }}>
            <strong>Code:</strong> {error.code}
          </p>
          <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
            <strong>Message:</strong> {error.message}
          </p>
        </section>
      )}

      {!result && status !== 'loading' && !error && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>空态</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            成功返回后，这里会显示当前单平台分析的 portrait summary、metrics、evidence、community
            breakdowns 和 warnings。
          </p>
        </section>
      )}

      {result && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Portrait Summary</h2>
            <p style={{ marginTop: 0 }}>
              <strong>Analyzed Platform:</strong>{' '}
              {communityMeta[lastSubmitted?.community ?? community].title}
            </p>
            <p>
              <strong>Submitted Handle:</strong>{' '}
              {lastSubmitted?.handle ?? 'N/A'}
            </p>
            <p>
              <strong>Archetype:</strong>{' '}
              {result.portrait?.archetype ?? 'N/A'}
            </p>
            <p>
              <strong>Tags:</strong>{' '}
              {result.portrait?.tags?.length
                ? result.portrait.tags.join(', ')
                : 'N/A'}
            </p>
            <p>
              <strong>Confidence:</strong>{' '}
              {formatConfidence(result.portrait?.confidence)}
            </p>
            <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
              <strong>Summary:</strong> {result.portrait?.summary ?? 'N/A'}
            </p>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Metrics</h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
              <li>
                totalActivities: {formatValue(result.metrics?.totalActivities)}
              </li>
              <li>topicCount: {formatValue(result.metrics?.topicCount)}</li>
              <li>replyCount: {formatValue(result.metrics?.replyCount)}</li>
              <li>
                avgTextLength: {formatValue(result.metrics?.avgTextLength)}
              </li>
              <li>activeDays: {formatValue(result.metrics?.activeDays)}</li>
            </ul>
          </section>

          {warnings.length > 0 && (
            <section
              style={{
                ...cardStyle,
                borderColor: '#d97706',
                background: '#fffbeb',
              }}
            >
              <h2 style={sectionTitleStyle}>Warnings</h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {warnings.map((warning, index) => (
                  <li key={`${warning.code ?? 'warning'}-${index}`}>
                    <strong>{warning.code ?? 'UNKNOWN_WARNING'}</strong>: {' '}
                    {warning.message ?? 'No message'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Evidence</h2>
            {evidence.length === 0 ? (
              <p style={{ margin: 0 }}>当前没有可展示的 evidence。</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {evidence.map((item, index) => (
                  <article
                    key={`${item.activityUrl ?? 'evidence'}-${index}`}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <p style={{ marginTop: 0 }}>
                      <strong>Label:</strong> {item.label ?? 'N/A'}
                    </p>
                    <p style={{ lineHeight: 1.6 }}>
                      <strong>Excerpt:</strong> {item.excerpt ?? 'N/A'}
                    </p>
                    <p>
                      <strong>Community:</strong> {item.community ?? 'N/A'}
                    </p>
                    <p>
                      <strong>Published At:</strong>{' '}
                      {item.publishedAt ?? 'N/A'}
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      <strong>Activity URL:</strong>{' '}
                      {item.activityUrl ? (
                        <a
                          href={item.activityUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.activityUrl}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Community Breakdowns</h2>
            {communityBreakdowns.length === 0 ? (
              <p style={{ margin: 0 }}>
                当前没有可展示的 community breakdown。
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {communityBreakdowns.map((item, index) => (
                  <article
                    key={`${item.community ?? 'community'}-${item.handle ?? index}`}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <p style={{ marginTop: 0 }}>
                      <strong>Community:</strong> {item.community ?? 'N/A'}
                    </p>
                    <p>
                      <strong>Handle:</strong> {item.handle ?? 'N/A'}
                    </p>
                    <p>
                      <strong>Tags:</strong>{' '}
                      {item.tags?.length ? item.tags.join(', ') : 'N/A'}
                    </p>
                    <p style={{ lineHeight: 1.6 }}>
                      <strong>Summary:</strong> {item.summary ?? 'N/A'}
                    </p>
                    <div>
                      <strong>Metrics:</strong>
                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                        {Object.entries(item.metrics ?? {}).length === 0 ? (
                          <li>N/A</li>
                        ) : (
                          Object.entries(item.metrics ?? {}).map(
                            ([key, value]) => (
                              <li key={key}>
                                {key}: {value}
                              </li>
                            ),
                          )
                        )}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
