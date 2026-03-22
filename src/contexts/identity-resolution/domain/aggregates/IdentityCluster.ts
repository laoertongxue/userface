import type { ExternalAccountRef } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export type IdentityCluster = {
  label?: string;
  accounts: ExternalAccountRef[];
  mergeSuggestions: Array<{
    left: ExternalAccountRef;
    right: ExternalAccountRef;
    confidence: number;
    reason: string;
  }>;
};
