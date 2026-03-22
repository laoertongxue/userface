export abstract class ValueObject<Value> {
  protected constructor(protected readonly value: Value) {}

  equals(other: ValueObject<Value>): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }

  get snapshot(): Readonly<Value> {
    return this.value;
  }
}
