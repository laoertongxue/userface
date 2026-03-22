'use client';

import { FormEvent, useState } from 'react';

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';

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

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #d1d5db',
  borderRadius: 12,
  background: '#ffffff',
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 20,
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
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedHandle = handle.trim();
    if (!normalizedHandle) {
      setStatus('error');
      setResult(null);
      setError({
        code: 'INVALID_INPUT',
        message: '请输入一个非空的 V2EX 用户名。',
      });
      return;
    }

    setStatus('loading');
    setError(null);
    setResult(null);

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
                community: 'v2ex',
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

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>输入区</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label htmlFor="v2ex-handle" style={{ fontWeight: 600 }}>
            V2EX 用户名
          </label>
          <input
            id="v2ex-handle"
            name="handle"
            type="text"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="例如：Livid"
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
            还没有发起分析。输入一个 V2EX 用户名后点击“开始分析”。
          </p>
        )}
        {status === 'loading' && (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            正在调用 <code>/api/analyze</code>，请等待结果返回。
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
            成功返回后，这里会显示 portrait summary、metrics、evidence、community
            breakdowns 和 warnings。
          </p>
        </section>
      )}

      {result && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Portrait Summary</h2>
            <p style={{ marginTop: 0 }}>
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
