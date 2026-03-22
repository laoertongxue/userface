export abstract class Entity<Props extends Record<string, unknown>> {
  protected constructor(protected readonly props: Props) {}

  get snapshot(): Readonly<Props> {
    return this.props;
  }
}
