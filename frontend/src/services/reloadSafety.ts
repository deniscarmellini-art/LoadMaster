export type ReloadSafetySnapshot = {
  edited: boolean;
  pendingWrites: number;
  uncertainWrites: number;
  criticalConfirmation: boolean;
};

export type WriteOutcome = "confirmed" | "rejected" | "uncertain";

const EMPTY: ReloadSafetySnapshot = Object.freeze({ edited: false, pendingWrites: 0, uncertainWrites: 0, criticalConfirmation: false });

/** In-memory guard used only to decide whether a post-maintenance reload is safe. */
export class ReloadSafetyRegistry {
  private snapshot: ReloadSafetySnapshot = EMPTY;
  private editRevision = 0;
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): ReloadSafetySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  markEdited(): void {
    this.editRevision += 1;
    if (!this.snapshot.edited) this.update({ ...this.snapshot, edited: true });
  }

  beginWrite(): (outcome: WriteOutcome) => void {
    const revisionAtStart = this.editRevision;
    this.update({ ...this.snapshot, pendingWrites: this.snapshot.pendingWrites + 1 });
    let finished = false;
    return (outcome) => {
      if (finished) return;
      finished = true;
      const pendingWrites = Math.max(0, this.snapshot.pendingWrites - 1);
      const edited = outcome === "confirmed" && this.editRevision === revisionAtStart ? false : this.snapshot.edited;
      const uncertainWrites = outcome === "uncertain" ? this.snapshot.uncertainWrites + 1 : this.snapshot.uncertainWrites;
      this.update({ edited, pendingWrites, uncertainWrites, criticalConfirmation: this.snapshot.criticalConfirmation });
    };
  }

  acknowledgeResolved(): void {
    if (this.snapshot.pendingWrites > 0) return;
    this.update({ edited: false, pendingWrites: 0, uncertainWrites: 0, criticalConfirmation: false });
  }

  setCriticalConfirmation(open: boolean): void {
    this.update({ ...this.snapshot, criticalConfirmation: open });
  }

  private update(next: ReloadSafetySnapshot): void {
    if (next.edited === this.snapshot.edited && next.pendingWrites === this.snapshot.pendingWrites && next.uncertainWrites === this.snapshot.uncertainWrites && next.criticalConfirmation === this.snapshot.criticalConfirmation) return;
    this.snapshot = Object.freeze(next);
    this.listeners.forEach((listener) => listener());
  }
}

export const reloadSafety = new ReloadSafetyRegistry();

export function maintenanceResumeCycle(previous: string | null, next: string): boolean {
  return previous === "maintenance" && next === "idle";
}

export function canReload(snapshot: ReloadSafetySnapshot): boolean {
  return !snapshot.edited && snapshot.pendingWrites === 0 && snapshot.uncertainWrites === 0 && !snapshot.criticalConfirmation;
}

export function classifyWriteResponse(status: number, code?: string): WriteOutcome {
  if (status >= 200 && status < 300) return "confirmed";
  if (status === 503 && code?.startsWith("MAINTENANCE_")) return "rejected";
  if (status === 408 || status >= 500) return "uncertain";
  return "rejected";
}
