import { readFileSync } from "node:fs";

export type MaintenanceNoticeState = "idle" | "scheduled";
export type EffectiveMaintenanceState = MaintenanceNoticeState | "maintenance";
export interface MaintenanceNoticeFile {
  formatVersion: 1;
  updateRevision: number;
  state: MaintenanceNoticeState;
  message: string | null;
  scheduledAt: string | null;
}
export type MaintenanceNoticeResponse = Omit<MaintenanceNoticeFile, "state"> & {
  state: EffectiveMaintenanceState;
  serverTime: string;
  remainingSeconds: number | null;
};

export interface MaintenanceReadOptions {
  /** PROD must never interpret a missing state file as permission to write. */
  missingIsError?: boolean;
}

export class MaintenanceStateUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MaintenanceStateUnavailableError";
  }
}

export const readMaintenanceNotice = (path: string | null | undefined, now = new Date(), options: MaintenanceReadOptions = {}): MaintenanceNoticeResponse => {
  let state: MaintenanceNoticeFile = { formatVersion: 1, updateRevision: 0, state: "idle", message: null, scheduledAt: null };
  if (!path && options.missingIsError) throw new MaintenanceStateUnavailableError("File di stato manutenzione PROD non configurato");
  if (path) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (!parsed || typeof parsed !== "object") throw new Error("Stato manutenzione non valido");
      const value = parsed as Record<string, unknown>;
      if (value.formatVersion !== 1 || (value.state !== "idle" && value.state !== "scheduled")) throw new Error("Stato manutenzione non valido");
      const updateRevision = value.updateRevision === undefined ? 0 : value.updateRevision;
      if (!Number.isSafeInteger(updateRevision) || (updateRevision as number) < 0) throw new Error("Revisione aggiornamento non valida");
      if (value.state === "scheduled") {
        if (typeof value.scheduledAt !== "string" || !Number.isFinite(Date.parse(value.scheduledAt)) || typeof value.message !== "string" || !value.message.trim())
          throw new Error("Stato manutenzione programmato non valido");
        state = { formatVersion: 1, updateRevision: updateRevision as number, state: "scheduled", message: value.message, scheduledAt: value.scheduledAt };
      } else {
        if (value.scheduledAt !== null || value.message !== null) throw new Error("Stato manutenzione idle non valido");
        state = { formatVersion: 1, updateRevision: updateRevision as number, state: "idle", message: null, scheduledAt: null };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (options.missingIsError) throw new MaintenanceStateUnavailableError("File di stato manutenzione PROD assente", { cause: error });
        // In TEST an absent first-run state file means no notice is scheduled.
      } else {
        throw new MaintenanceStateUnavailableError("File di stato manutenzione illeggibile o danneggiato", { cause: error });
      }
    }
  }
  const serverTime = now.toISOString();
  const remainingSeconds = state.state === "scheduled"
    ? Math.max(0, Math.ceil((Date.parse(state.scheduledAt!) - now.getTime()) / 1000))
    : null;
  return {
    ...state,
    state: remainingSeconds === 0 ? "maintenance" : state.state,
    serverTime,
    remainingSeconds,
  };
};

/**
 * Synchronous check-and-count admission gate. Fastify invokes the onRequest
 * hook on Node's event loop; no await occurs between reading the state and
 * incrementing this process-local counter.
 */
export class MaintenanceWriteGate {
  private activeWriteRequests = 0;

  constructor(private readonly statePath: string | null | undefined, private readonly missingIsError = false) {}

  tryBeginWrite(now = new Date()): boolean {
    const status = readMaintenanceNotice(this.statePath, now, { missingIsError: this.missingIsError });
    if (status.state === "maintenance") return false;
    this.activeWriteRequests += 1;
    return true;
  }

  finishWrite(): void {
    if (this.activeWriteRequests > 0) this.activeWriteRequests -= 1;
  }

  getActiveWriteRequests(): number {
    return this.activeWriteRequests;
  }

  getStatus(now = new Date()): MaintenanceNoticeResponse & { activeWriteRequests: number } {
    return { ...readMaintenanceNotice(this.statePath, now, { missingIsError: this.missingIsError }), activeWriteRequests: this.activeWriteRequests };
  }
}
