import { createHash } from 'node:crypto';

export interface HashService {
  sha256(input: string): string;
}

export class NodeHashService implements HashService {
  sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
