import type { ExternalAccountRef } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export type ResolveIdentityInput = {
  label?: string;
  accounts: ExternalAccountRef[];
};
