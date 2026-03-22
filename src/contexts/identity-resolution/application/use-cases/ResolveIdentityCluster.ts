import type { ResolveIdentityInput } from '@/src/contexts/identity-resolution/application/dto/ResolveIdentityInput';
import type { IdentityCluster } from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import { uniqueBy } from '@/src/shared/utils/collection';

export class ResolveIdentityCluster {
  execute(input: ResolveIdentityInput): IdentityCluster {
    const accounts = uniqueBy(
      input.accounts.map((account) => ({
        ...account,
        handle: account.handle.trim(),
      })),
      (account) => `${account.community}:${account.uid ?? account.handle.toLowerCase()}`,
    );

    return {
      label: input.label,
      accounts,
      mergeSuggestions: [],
    };
  }
}
