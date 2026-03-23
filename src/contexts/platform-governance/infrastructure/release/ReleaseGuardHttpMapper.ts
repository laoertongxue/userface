import type { ReleaseGuardDecision, ReleaseReasonCode } from '@/src/contexts/platform-governance/application/dto/ReleaseGuardDecision';

function toMessage(code: ReleaseReasonCode | undefined): string {
  switch (code) {
    case 'RELEASE_ANALYZE_DISABLED':
      return 'Analyze is temporarily disabled.';
    case 'RELEASE_CLUSTER_DISABLED':
      return 'Cluster analysis is temporarily disabled.';
    case 'RELEASE_SUGGEST_DISABLED':
      return 'Identity suggestion is temporarily disabled.';
    case 'RELEASE_INCIDENT_CLUSTER_DISABLED':
      return 'Cluster analysis is temporarily disabled due to incident mode.';
    case 'RELEASE_INCIDENT_SUGGEST_DISABLED':
      return 'Identity suggestion is temporarily disabled due to incident mode.';
    case 'RELEASE_NARRATIVE_DISABLED':
      return 'Narrative enhancement is temporarily disabled.';
    case 'RELEASE_MINIMAX_DISABLED':
      return 'MiniMax narrative generation is temporarily disabled.';
    case 'RELEASE_INCIDENT_FORCE_RULE_ONLY':
      return 'Narrative generation is temporarily forced to RuleOnly due to incident mode.';
    case 'RELEASE_INCIDENT_NARRATIVE_DISABLED':
      return 'Narrative enhancement is temporarily disabled due to incident mode.';
    default:
      return 'Request rejected by release safety policy.';
  }
}

export class ReleaseGuardHttpMapper {
  toHttpPayload(decision: ReleaseGuardDecision): {
    status: number;
    body: {
      error: {
        code: string;
        message: string;
      };
    };
  } {
    if (decision.allowed) {
      throw new Error('ReleaseGuardHttpMapper only maps rejected release decisions.');
    }

    const code = decision.reasonCodes[0] ?? 'RELEASE_REJECTED';

    return {
      status: decision.httpStatus ?? 503,
      body: {
        error: {
          code,
          message: toMessage(code as ReleaseReasonCode | undefined),
        },
      },
    };
  }
}
