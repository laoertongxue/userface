import type { RequestBudget } from '@/src/contexts/platform-governance/domain/entities/RequestBudget';
import type { RuntimeExecutionPolicy } from '@/src/contexts/platform-governance/domain/entities/RuntimeExecutionPolicy';
import type { RequestComplexitySnapshot } from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import type { ObservabilityContext } from '@/src/contexts/platform-governance/infrastructure/observability/ObservabilityContext';

export type EnforceRequestGovernanceInput = {
  snapshot: RequestComplexitySnapshot;
  requestBudget: RequestBudget;
  executionPolicy: RuntimeExecutionPolicy;
  observability?: ObservabilityContext;
};
