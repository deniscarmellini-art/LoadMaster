export const UPDATE_REVISION_KEY = "sislog-update-revision";
export const PENDING_REVISION_KEY = "sislog-update-revision-pending";

export function parseRevision(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export function isNewUpdateRevision(observed: number, current: number): boolean {
  return current > observed;
}

export function revisionCycle(revision: number): string {
  return `revision-${revision}`;
}

export function revisionFromCycle(cycle: string): number | null {
  const match = /^revision-(\d+)$/.exec(cycle);
  return match ? parseRevision(match[1]) : null;
}

export type RevisionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function observeUpdateRevision(
  storage: RevisionStorage,
  current: number,
  inMemoryObserved: number | null,
): { observed: number; pending: number | null } {
  let stored: number | null = null;
  let pending: number | null = null;
  try {
    stored = parseRevision(storage.getItem(UPDATE_REVISION_KEY));
    pending = parseRevision(storage.getItem(PENDING_REVISION_KEY));
  } catch { /* In-memory fallback keeps this tab safe while storage is unavailable. */ }
  const observed = stored ?? inMemoryObserved ?? current;
  let target = pending !== null && pending > observed ? pending : null;
  if (current > observed) target = Math.max(target ?? 0, current);
  if (stored === null) {
    try { storage.setItem(UPDATE_REVISION_KEY, String(observed)); } catch { /* current tab still retains the baseline in memory */ }
  }
  if (target !== null) {
    try { storage.setItem(PENDING_REVISION_KEY, String(target)); } catch { /* current tab retains the pending revision in component state */ }
  } else if (pending !== null) {
    try { storage.removeItem(PENDING_REVISION_KEY); } catch { /* optional per-tab persistence */ }
  }
  return { observed, pending: target };
}

export function markUpdateRevisionApplied(storage: RevisionStorage, revision: number): void {
  try {
    storage.setItem(UPDATE_REVISION_KEY, String(revision));
    storage.removeItem(PENDING_REVISION_KEY);
  } catch { /* a new document establishes its current revision as baseline */ }
}
