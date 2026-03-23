import type { GovernanceDecision } from '@/src/contexts/platform-governance/application/dto/GovernanceDecision';

export type GovernanceHttpPayload = {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
      retryAfterSeconds?: number;
    };
  };
};

export class GovernanceHttpMapper {
  toHttpPayload(decision: GovernanceDecision): GovernanceHttpPayload {
    if (decision.allowed) {
      throw new Error('GovernanceHttpMapper only maps rejected governance decisions.');
    }

    return {
      status: decision.httpStatus ?? 400,
      body: {
        error: {
          code: decision.errorCode ?? 'GOVERNANCE_REJECTED',
          message: decision.message ?? 'Request rejected by request governance.',
          ...(decision.retryAfterSeconds
            ? { retryAfterSeconds: decision.retryAfterSeconds }
            : {}),
        },
      },
    };
  }
}
