export type OperationalSortDirection = "asc" | "desc";
export type OperationalSortValue = string | number | null | undefined;

const textCollator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

/** Sorts a copy, compares numeric values numerically and keeps equal rows stable. */
export function sortOperationalRows<T, K extends string>(
  rows: readonly T[],
  sortKey: K | null,
  direction: OperationalSortDirection,
  valueFor: (row: T, key: K) => OperationalSortValue,
): T[] {
  if (!sortKey) return [...rows];
  const factor = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: valueFor(row, sortKey) }))
    .sort((left, right) => {
      const a = left.value;
      const b = right.value;
      if (a == null || b == null) {
        if (a == null && b == null) return left.index - right.index;
        return a == null ? 1 : -1;
      }
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : textCollator.compare(String(a), String(b));
      return comparison === 0 ? left.index - right.index : comparison * factor;
    })
    .map(({ row }) => row);
}
