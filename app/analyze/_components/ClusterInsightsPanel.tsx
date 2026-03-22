import React from 'react';
import type { AnalyzeMode, AnalyzeResponse } from '@/app/analyze/types';
import {
  formatConfidence,
  insetPanelStyle,
  itemCardStyle,
  panelStyle,
  pillBaseStyle,
  sectionTitleStyle,
  subSectionTitleStyle,
} from '@/app/analyze/_components/resultUi';

type ClusterInsightsPanelProps = {
  mode: AnalyzeMode;
  result: AnalyzeResponse;
};

export function ClusterInsightsPanel({ mode, result }: ClusterInsightsPanelProps) {
  const cluster = result.cluster;

  if (!cluster) {
    return null;
  }

  const stableTraits = cluster.stableTraits ?? [];
  const communitySpecificTraits = cluster.communitySpecificTraits ?? {};
  const overlap = cluster.overlap ?? [];
  const divergence = cluster.divergence ?? [];
  const accountCoverage = cluster.accountCoverage;
  const hasCommunitySpecifics = Object.values(communitySpecificTraits).some(
    (traits) => (traits?.length ?? 0) > 0,
  );
  const shouldShowCoverage =
    mode === 'MANUAL_CLUSTER' ||
    (accountCoverage?.requestedAccounts?.length ?? 0) > 1 ||
    (accountCoverage?.failedCount ?? 0) > 0;
  const hasAnyContent =
    stableTraits.length > 0 ||
    hasCommunitySpecifics ||
    overlap.length > 0 ||
    divergence.length > 0 ||
    shouldShowCoverage;

  if (!hasAnyContent) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Traits & Cluster Insights</h2>

      {result.narrative?.stableTraitsSummary && (
        <p style={{ marginTop: 0, lineHeight: 1.8 }}>{result.narrative.stableTraitsSummary}</p>
      )}

      {stableTraits.length > 0 && (
        <div style={{ marginBottom: hasCommunitySpecifics || overlap.length > 0 || divergence.length > 0 || shouldShowCoverage ? 18 : 0 }}>
          <h3 style={subSectionTitleStyle}>Stable Traits</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {stableTraits.map((trait) => (
              <div
                key={trait.code ?? trait.displayName}
                style={{
                  ...itemCardStyle('accent'),
                  minWidth: 180,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {trait.displayName ?? trait.code ?? 'unknown'}
                </div>
                <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
                  {formatConfidence(trait.confidence)}
                </div>
                {(trait.sourceCommunities?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {trait.sourceCommunities?.map((community) => (
                      <span key={community} style={pillBaseStyle}>
                        {community}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasCommunitySpecifics && (
        <div style={{ marginBottom: overlap.length > 0 || divergence.length > 0 || shouldShowCoverage ? 18 : 0 }}>
          <h3 style={subSectionTitleStyle}>Community-Specific Traits</h3>
          {result.narrative?.communitySpecificSummary && (
            <p style={{ marginTop: 0, lineHeight: 1.7 }}>{result.narrative.communitySpecificSummary}</p>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(communitySpecificTraits)
              .filter(([, traits]) => (traits?.length ?? 0) > 0)
              .map(([community, traits]) => (
                <details
                  key={community}
                  open={mode === 'MANUAL_CLUSTER'}
                  style={insetPanelStyle}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                    {community} · {(traits?.length ?? 0)} 个 traits
                  </summary>
                  <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                    {traits.map((trait, index) => (
                      <li key={`${community}-${trait.code ?? index}`}>
                        <strong>{trait.displayName ?? trait.code ?? 'unknown'}</strong>
                        {trait.strength !== undefined ? ` (${formatConfidence(trait.strength)})` : ''}
                        {trait.rationale ? ` · ${trait.rationale}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
          </div>
        </div>
      )}

      {(overlap.length > 0 || divergence.length > 0) && (
        <div style={{ marginBottom: shouldShowCoverage ? 18 : 0 }}>
          <h3 style={subSectionTitleStyle}>Overlap & Divergence</h3>
          {result.narrative?.overlapDivergenceSummary && (
            <p style={{ marginTop: 0, lineHeight: 1.7 }}>{result.narrative.overlapDivergenceSummary}</p>
          )}
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {overlap.length > 0 && (
              <div
                style={itemCardStyle()}
              >
                <strong>Overlap</strong>
                <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                  {overlap.map((item, index) => (
                    <li key={`${item.code ?? 'overlap'}-${index}`}>
                      <strong>{item.code ?? 'unknown'}</strong>
                      {(item.communities?.length ?? 0) > 0 ? ` · ${item.communities?.join('、')}` : ''}
                      {item.rationale ? ` · ${item.rationale}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {divergence.length > 0 && (
              <div
                style={itemCardStyle()}
              >
                <strong>Divergence</strong>
                <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                  {divergence.map((item, index) => (
                    <li key={`${item.code ?? 'divergence'}-${index}`}>
                      <strong>{item.code ?? 'unknown'}</strong>
                      {item.dominantCommunity ? ` · dominant: ${item.dominantCommunity}` : ''}
                      {item.rationale ? ` · ${item.rationale}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {shouldShowCoverage && (
        <div style={{ display: 'grid', gap: 16 }}>
          {cluster.confidence && (
            <div>
              <h3 style={subSectionTitleStyle}>Cluster Confidence</h3>
              <div style={{ marginBottom: 8 }}>
                <strong>{formatConfidence(cluster.confidence.overall)}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {(cluster.confidence.flags ?? []).map((flag) => (
                  <span key={flag} style={pillBaseStyle}>
                    {flag}
                  </span>
                ))}
              </div>
              {(cluster.confidence.reasons?.length ?? 0) > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                  {(cluster.confidence.reasons ?? []).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {accountCoverage && (
            <div>
              <h3 style={subSectionTitleStyle}>Account Coverage</h3>
              <p style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.7 }}>
                requested {accountCoverage.requestedAccounts?.length ?? 0} · success{' '}
                {accountCoverage.successfulCount ?? 0} · failed {accountCoverage.failedCount ?? 0}
                {(accountCoverage.activeCommunities?.length ?? 0) > 0
                  ? ` · communities: ${accountCoverage.activeCommunities?.join('、')}`
                  : ''}
              </p>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <strong>Requested</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(accountCoverage.requestedAccounts ?? []).map((account, index) => (
                      <li key={`${account.community ?? 'unknown'}-${account.handle ?? index}`}>
                        {account.community ?? 'unknown'}:{account.handle ?? 'N/A'}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Successful</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(accountCoverage.successfulAccounts?.length ?? 0) === 0 ? (
                      <li>N/A</li>
                    ) : (
                      (accountCoverage.successfulAccounts ?? []).map((account, index) => (
                        <li key={`${account.community ?? 'unknown'}-${account.handle ?? index}`}>
                          {account.community ?? 'unknown'}:{account.handle ?? 'N/A'}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Failed</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(accountCoverage.failedAccounts?.length ?? 0) === 0 ? (
                      <li>N/A</li>
                    ) : (
                      (accountCoverage.failedAccounts ?? []).map((entry, index) => (
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
              </div>

              {(accountCoverage.accountStatuses?.length ?? 0) > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    查看 account status 明细
                  </summary>
                  <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    {(accountCoverage.accountStatuses ?? []).map((entry, index) => (
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
          )}
        </div>
      )}
    </section>
  );
}
