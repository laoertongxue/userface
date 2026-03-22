import type { ResolveIdentityInput } from '@/src/contexts/identity-resolution/application/dto/ResolveIdentityInput';
import {
  createIdentityCluster,
  normalizeClusterAccountRef,
  type IdentityCluster,
} from '@/src/contexts/identity-resolution/domain/aggregates/IdentityCluster';
import type { AccountLink } from '@/src/contexts/identity-resolution/domain/entities/AccountLink';
import { uniqueBy } from '@/src/shared/utils/collection';

function buildUserAssertedLinks(accounts: IdentityCluster['accounts']): AccountLink[] {
  const links: AccountLink[] = [];

  for (let index = 0; index < accounts.length; index += 1) {
    for (let cursor = index + 1; cursor < accounts.length; cursor += 1) {
      links.push({
        from: accounts[index],
        to: accounts[cursor],
        source: 'USER_ASSERTED',
        confidence: 1,
        rationale: 'Accounts were explicitly submitted together for a single analysis subject.',
      });
    }
  }

  return links;
}

export class ResolveIdentityCluster {
  execute(input: ResolveIdentityInput): IdentityCluster {
    const accounts = uniqueBy(
      input.accounts.map((account) => normalizeClusterAccountRef(account)),
      (account) => `${account.community}:${account.handle.toLowerCase()}`,
    );
    const mode = input.mode ?? (accounts.length === 1 ? 'SINGLE_ACCOUNT' : 'MANUAL_CLUSTER');

    return createIdentityCluster({
      label: input.label,
      accounts,
      links: buildUserAssertedLinks(accounts),
      mode,
    });
  }
}
