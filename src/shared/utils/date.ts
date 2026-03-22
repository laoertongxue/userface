const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export function toIsoDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function countDistinctDays(values: string[]): number {
  return new Set(values.map((value) => new Date(value).toISOString().slice(0, 10))).size;
}

export function dayDiff(from: string, to: string): number {
  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / ONE_DAY_MS),
  );
}
