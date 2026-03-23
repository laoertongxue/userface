import type { AbuseSignal } from '@/src/contexts/platform-governance/domain/entities/AbuseSignal';
import type { GovernanceErrorCode } from '@/src/contexts/platform-governance/application/dto/GovernanceDecision';

type GovernanceErrorInput = {
  code: GovernanceErrorCode;
  message: string;
  httpStatus: number;
  retryAfterSeconds?: number;
  abuseSignals: AbuseSignal[];
};

export class GovernanceError extends Error {
  readonly code: GovernanceErrorCode;
  readonly httpStatus: number;
  readonly retryAfterSeconds?: number;
  readonly abuseSignals: AbuseSignal[];

  constructor(input: GovernanceErrorInput) {
    super(input.message);
    this.name = 'GovernanceError';
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.abuseSignals = input.abuseSignals;
  }
}
