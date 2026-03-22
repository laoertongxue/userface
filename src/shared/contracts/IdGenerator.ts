export interface IdGenerator {
  next(prefix?: string): string;
}

export class TimestampIdGenerator implements IdGenerator {
  next(prefix = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
