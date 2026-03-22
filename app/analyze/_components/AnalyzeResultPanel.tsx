'use client';

import type { CSSProperties } from 'react';
import type { AnalyzeMode, AnalyzeResponse, DraftAccount } from '@/app/analyze/types';

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

type AnalyzeResultPanelProps = {
  mode: AnalyzeMode;
  result: AnalyzeResponse;
  submittedAccounts: DraftAccount[];
};

export function AnalyzeResultPanel({
  mode,
  result,
  submittedAccounts,
}: AnalyzeResultPanelProps) {
  const warnings = result.warnings ?? [];
  const evidence = result.evidence ?? [];
  const communityBreakdowns = result.communityBreakdowns ?? [];
  const cluster = result.cluster;
  const shouldShowCluster = mode === 'MANUAL_CLUSTER' && !!cluster;

  return (
    <>
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Portrait Summary</h2>
        <p style={{ marginTop: 0 }}>
          <strong>Mode:</strong> {mode === 'MANUAL_CLUSTER' ? 'MANUAL_CLUSTER' : 'SINGLE_ACCOUNT'}
        </p>
        <p>
          <strong>Submitted Accounts:</strong>{' '}
          {submittedAccounts.map((account) => `${account.community}:${account.handle}`).join(', ') || 'N/A'}
        </p>
        <p>
          <strong>Archetype:</strong> {result.portrait?.archetype ?? 'N/A'}
        </p>
        <p>
          <strong>Tags:</strong> {result.portrait?.tags?.length ? result.portrait.tags.join(', ') : 'N/A'}
        </p>
        <p>
          <strong>Confidence:</strong> {formatConfidence(result.portrait?.confidence)}
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
          <strong>Summary:</strong> {result.portrait?.summary ?? 'N/A'}
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Metrics</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>totalActivities: {formatValue(result.metrics?.totalActivities)}</li>
          <li>topicCount: {formatValue(result.metrics?.topicCount)}</li>
          <li>replyCount: {formatValue(result.metrics?.replyCount)}</li>
          <li>avgTextLength: {formatValue(result.metrics?.avgTextLength)}</li>
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
                <strong>{warning.code ?? 'UNKNOWN_WARNING'}</strong>: {warning.message ?? 'No message'}
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
                  <strong>Published At:</strong> {item.publishedAt ?? 'N/A'}
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong>Activity URL:</strong>{' '}
                  {item.activityUrl ? (
                    <a href={item.activityUrl} target="_blank" rel="noreferrer">
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
          <p style={{ margin: 0 }}>当前没有可展示的 community breakdown。</p>
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
                  <strong>Tags:</strong> {item.tags?.length ? item.tags.join(', ') : 'N/A'}
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
                      Object.entries(item.metrics ?? {}).map(([key, value]) => (
                        <li key={key}>
                          {key}: {value}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {shouldShowCluster && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Stable Traits</h2>
            {(cluster.stableTraits?.length ?? 0) === 0 ? (
              <p style={{ margin: 0 }}>当前没有可展示的 stable traits。</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {(cluster.stableTraits ?? []).map((trait, index) => (
                  <li key={`${trait.code ?? 'trait'}-${index}`}>
                    <strong>{trait.displayName ?? trait.code ?? 'unknown'}</strong>
                    {trait.confidence !== undefined ? ` (${formatConfidence(trait.confidence)})` : ''}
                    {(trait.sourceCommunities?.length ?? 0) > 0
                      ? ` · communities: ${trait.sourceCommunities?.join(', ')}`
                      : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Community-Specific Traits</h2>
            {Object.keys(cluster.communitySpecificTraits ?? {}).length === 0 ? (
              <p style={{ margin: 0 }}>当前没有明显的 community-specific traits。</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {Object.entries(cluster.communitySpecificTraits ?? {}).map(([community, traits]) => (
                  <article
                    key={community}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <p style={{ marginTop: 0 }}>
                      <strong>Community:</strong> {community}
                    </p>
                    {(traits?.length ?? 0) === 0 ? (
                      <p style={{ marginBottom: 0 }}>当前没有额外 community-specific trait。</p>
                    ) : (
                      <ul style={{ marginBottom: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                        {traits.map((trait, index) => (
                          <li key={`${community}-${trait.code ?? 'trait'}-${index}`}>
                            <strong>{trait.displayName ?? trait.code ?? 'unknown'}</strong>
                            {trait.strength !== undefined ? ` (${formatConfidence(trait.strength)})` : ''}
                            {trait.rationale ? ` · ${trait.rationale}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Overlap / Divergence</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <strong>Overlap</strong>
                {(cluster.overlap?.length ?? 0) === 0 ? (
                  <p style={{ marginBottom: 0 }}>当前没有可展示的 overlap。</p>
                ) : (
                  <ul style={{ marginBottom: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                    {(cluster.overlap ?? []).map((item, index) => (
                      <li key={`${item.code ?? 'overlap'}-${index}`}>
                        <strong>{item.code ?? 'unknown'}</strong>
                        {(item.communities?.length ?? 0) > 0 ? ` · ${item.communities?.join(', ')}` : ''}
                        {item.rationale ? ` · ${item.rationale}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <strong>Divergence</strong>
                {(cluster.divergence?.length ?? 0) === 0 ? (
                  <p style={{ marginBottom: 0 }}>当前没有可展示的 divergence。</p>
                ) : (
                  <ul style={{ marginBottom: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                    {(cluster.divergence ?? []).map((item, index) => (
                      <li key={`${item.code ?? 'divergence'}-${index}`}>
                        <strong>{item.code ?? 'unknown'}</strong>
                        {item.dominantCommunity ? ` · dominant: ${item.dominantCommunity}` : ''}
                        {item.rationale ? ` · ${item.rationale}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Cluster Confidence</h2>
            {cluster.confidence ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <p style={{ margin: 0 }}>
                  <strong>Overall:</strong> {formatConfidence(cluster.confidence.overall)}
                </p>
                <div>
                  <strong>Reasons:</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(cluster.confidence.reasons?.length ?? 0) === 0 ? (
                      <li>N/A</li>
                    ) : (
                      (cluster.confidence.reasons ?? []).map((reason, index) => (
                        <li key={`${reason}-${index}`}>{reason}</li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Flags:</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(cluster.confidence.flags?.length ?? 0) === 0 ? (
                      <li>N/A</li>
                    ) : (
                      (cluster.confidence.flags ?? []).map((flag, index) => (
                        <li key={`${flag}-${index}`}>{flag}</li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0 }}>当前没有 cluster-level confidence。</p>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Account Coverage</h2>
            {cluster.accountCoverage ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <p style={{ margin: 0 }}>
                  <strong>Counts:</strong> requested {cluster.accountCoverage.requestedAccounts?.length ?? 0}
                  , success {cluster.accountCoverage.successfulCount ?? 0}, failed{' '}
                  {cluster.accountCoverage.failedCount ?? 0}
                </p>
                <div>
                  <strong>Requested Accounts</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(cluster.accountCoverage.requestedAccounts ?? []).map((account, index) => (
                      <li key={`${account.community ?? 'unknown'}-${account.handle ?? index}`}>
                        {account.community ?? 'unknown'}:{account.handle ?? 'N/A'}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Successful Accounts</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(cluster.accountCoverage.successfulAccounts?.length ?? 0) === 0 ? (
                      <li>N/A</li>
                    ) : (
                      (cluster.accountCoverage.successfulAccounts ?? []).map((account, index) => (
                        <li key={`${account.community ?? 'unknown'}-${account.handle ?? index}`}>
                          {account.community ?? 'unknown'}:{account.handle ?? 'N/A'}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Failed Accounts</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(cluster.accountCoverage.failedAccounts?.length ?? 0) === 0 ? (
                      <li>N/A</li>
                    ) : (
                      (cluster.accountCoverage.failedAccounts ?? []).map((entry, index) => (
                        <li
                          key={`${entry.account?.community ?? 'unknown'}-${entry.account?.handle ?? index}`}
                        >
                          {entry.account?.community ?? 'unknown'}:{entry.account?.handle ?? 'N/A'}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                {(cluster.accountCoverage.accountStatuses?.length ?? 0) > 0 && (
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      查看 account status 明细
                    </summary>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                      {(cluster.accountCoverage.accountStatuses ?? []).map((entry, index) => (
                        <li
                          key={`${entry.account?.community ?? 'unknown'}-${entry.account?.handle ?? index}-${entry.status ?? 'status'}`}
                        >
                          {entry.account?.community ?? 'unknown'}:{entry.account?.handle ?? 'N/A'} ·{' '}
                          {entry.status ?? 'UNKNOWN'}
                          {entry.degraded ? ' · degraded' : ''}
                          {(entry.warningCodes?.length ?? 0) > 0
                            ? ` · warnings: ${entry.warningCodes?.join(', ')}`
                            : ''}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <p style={{ margin: 0 }}>当前没有 account coverage。</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
