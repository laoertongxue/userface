export function uniqueBy<T, Key>(items: T[], selector: (item: T) => Key): T[] {
  const seen = new Set<Key>();

  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
