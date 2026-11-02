export type MaintenanceNotice = {
  formatVersion: 1;
  updateRevision: number;
  state: "idle" | "scheduled" | "maintenance";
  message: string | null;
  scheduledAt: string | null;
  serverTime: string;
  remainingSeconds: number | null;
};

export async function getMaintenanceNotice(signal?: AbortSignal): Promise<MaintenanceNotice> {
  const response = await fetch("/api/maintenance", { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Stato manutenzione non disponibile (${response.status})`);
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new Error("Risposta stato manutenzione non valida");
  const notice = value as Partial<MaintenanceNotice>;
  if (notice.formatVersion !== 1 || !Number.isSafeInteger(notice.updateRevision) || (notice.updateRevision as number) < 0 || (notice.state !== "idle" && notice.state !== "scheduled" && notice.state !== "maintenance") || typeof notice.serverTime !== "string" || !Number.isFinite(Date.parse(notice.serverTime)))
    throw new Error("Risposta stato manutenzione non valida");
  if ((notice.state === "scheduled" || notice.state === "maintenance") && (typeof notice.scheduledAt !== "string" || !Number.isFinite(Date.parse(notice.scheduledAt)) || typeof notice.message !== "string" || typeof notice.remainingSeconds !== "number"))
    throw new Error("Risposta stato manutenzione non valida");
  return notice as MaintenanceNotice;
}
