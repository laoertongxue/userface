import React from 'react';
import type { AnalyzeMode, AnalyzeResponse, DraftAccount } from '@/app/analyze/types';
import { CaveatsPanel } from '@/app/analyze/_components/CaveatsPanel';
import { ClusterInsightsPanel } from '@/app/analyze/_components/ClusterInsightsPanel';
import { CommunityInsightsPanel } from '@/app/analyze/_components/CommunityInsightsPanel';
import { EvidencePanel } from '@/app/analyze/_components/EvidencePanel';
import { NarrativeSummaryPanel } from '@/app/analyze/_components/NarrativeSummaryPanel';
import { StructuredMetricsPanel } from '@/app/analyze/_components/StructuredMetricsPanel';

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
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <NarrativeSummaryPanel
        mode={mode}
        result={result}
        submittedAccounts={submittedAccounts}
      />
      <CaveatsPanel result={result} />
      <ClusterInsightsPanel mode={mode} result={result} />
      <EvidencePanel result={result} />
      <StructuredMetricsPanel result={result} />
      <CommunityInsightsPanel result={result} />
    </div>
  );
}
