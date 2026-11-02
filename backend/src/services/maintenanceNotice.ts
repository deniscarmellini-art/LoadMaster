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

export const readMaintenanceNotice = (path: string | null | undefined, now = new Date()): MaintenanceNoticeResponse => {
  let state: MaintenanceNoticeFile = { formatVersion: 1, updateRevision: 0, state: "idle", message: null, scheduledAt: null };
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
        // An absent first-run state file means no notice has been scheduled.
      } else {
        throw new Error("Stato manutenzione TEST illeggibile o danneggiato", { cause: error });
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

export const isMaintenanceActive = (path: string | null | undefined, now = new Date()): boolean => {
  const status = readMaintenanceNotice(path, now);
  return status.state === "maintenance";
};
