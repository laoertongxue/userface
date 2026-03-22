import type { SuggestIdentityInput } from '@/src/contexts/identity-resolution/application/dto/SuggestIdentityInput';

export class SuggestIdentityLinks {
  execute(input: SuggestIdentityInput) {
    const suggestions = [];

    for (let index = 0; index < input.accounts.length; index += 1) {
      for (let cursor = index + 1; cursor < input.accounts.length; cursor += 1) {
        const left = input.accounts[index];
        const right = input.accounts[cursor];

        if (left.community === right.community) {
          continue;
        }

        if (left.handle.toLowerCase() === right.handle.toLowerCase()) {
          suggestions.push({
            left,
            right,
            confidence: 0.72,
            reason: 'Exact handle match across different communities.',
          });
        }
      }
    }

    return suggestions;
  }
}
