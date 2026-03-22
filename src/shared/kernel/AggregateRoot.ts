import { Entity } from '@/src/shared/kernel/Entity';

export abstract class AggregateRoot<Props extends Record<string, unknown>> extends Entity<Props> {}
