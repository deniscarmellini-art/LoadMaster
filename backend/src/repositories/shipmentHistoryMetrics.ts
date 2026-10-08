import type { DatabaseSync } from "node:sqlite";

export interface ShipmentHistoryMetrics {
  originalPlannedDepartureDate: string | null;
  warehouseDays: number | null;
  materialAvailableAt?: string | null;
  manifestVersion?: number | null;
  manifestHash?: string | null;
  anomaly?: string | null;
}

const dateOnly = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
};

// Read-only projection. The migration backfilled originalPlannedDepartureDate
// from the current date; that column alone cannot certify the first plan.
export function shipmentHistoryMetrics(database: DatabaseSync, loadId: string, shippedAt: string | null): ShipmentHistoryMetrics {
  const result: ShipmentHistoryMetrics = { originalPlannedDepartureDate: null, warehouseDays: null };
  if (!shippedAt || !Number.isFinite(Date.parse(shippedAt))) return result;
  // Old databases and old shipments have no certified snapshot. Never backfill.
  if (database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='LoadMaterialAvailabilityShipments'").get()) {
    const snapshot=database.prepare("SELECT availableAt,manifestVersion,manifestHash,warehouseDays,anomaly FROM LoadMaterialAvailabilityShipments WHERE loadId=?").get(loadId) as {availableAt:string|null;manifestVersion:number;manifestHash:string;warehouseDays:number|null;anomaly:string|null}|undefined;
    if (snapshot) Object.assign(result,{warehouseDays:snapshot.warehouseDays,materialAvailableAt:snapshot.availableAt,manifestVersion:snapshot.manifestVersion,manifestHash:snapshot.manifestHash,anomaly:snapshot.anomaly});
  }
  const events = database.prepare("SELECT type,timestamp,note FROM OperationalEvents WHERE loadId=? AND type IN ('SHIPMENT_PLAN_CREATED','SHIPMENT_PLAN_UPDATED') ORDER BY timestamp,id").all(loadId) as Array<{type:string;timestamp:string;note:string|null}>;
  return certifiedPlanMetrics(loadId, shippedAt, events, result);
}

export function certifiedPlanMetrics(loadId:string, shippedAt:string, events:Array<{type:string;timestamp:string;note:string|null}>, result:ShipmentHistoryMetrics):ShipmentHistoryMetrics {
  const witnessedPlans = new Set<string>();
  for (const event of events) {
    if (!Number.isFinite(Date.parse(event.timestamp)) || Date.parse(event.timestamp) > Date.parse(shippedAt)) continue;
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(event.note ?? "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return result;
      data = parsed as Record<string, unknown>;
    } catch { return result; }
    if (event.type === "SHIPMENT_PLAN_CREATED") {
      if (typeof data.id !== "string" || data.loadId !== loadId) return result;
      witnessedPlans.add(data.id);
      const initial = dateOnly(data.plannedDepartureDate);
      if (initial) return { ...result, originalPlannedDepartureDate: initial };
      if (data.plannedDepartureDate) return result;
    } else {
      const before = data.before as Record<string, unknown> | undefined;
      const after = data.after as Record<string, unknown> | undefined;
      // A linked manual plan has no creation audit: do not infer its first date.
      if (!before || typeof before.id !== "string" || !witnessedPlans.has(before.id) || before.loadId !== loadId || !after) return result;
      if (before.plannedDepartureDate) return result;
      const first = dateOnly(after.plannedDepartureDate);
      if (first) return { ...result, originalPlannedDepartureDate: first };
      if (after.plannedDepartureDate) return result;
    }
  }
  // Only the immutable shipment snapshot supplies warehouse days, with no
  // fallback to import, scans or physical LoadingSessions.completedAt.
  return result;
}
