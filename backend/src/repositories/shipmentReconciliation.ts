import type { DatabaseSync } from "node:sqlite";

const orderKey = (value: string) => value.trim().toUpperCase();
const truckKey = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "");
interface ManualPlan { id: string; manualCommessa: string; manualCarico: string | null; actualDepartureDate: string | null }
interface ActiveLoad { id: string; commessa: string; camion: string }
export interface ShipmentLinkDecision {
  planId: string;
  commessa: string;
  camion: string | null;
  candidateLoadIds: string[];
  loadId: string | null;
  reason: "SUGGESTION" | "NO_MATCH" | "AMBIGUOUS_LOADS" | "LOAD_ALREADY_PLANNED" | "COMPETING_PLANS" | "DEPARTED_PLAN";
}

// Read-only textual suggestions; SUGGESTION never authorizes an automatic link.
// Evaluate the whole order after all trucks have been imported. Never narrow a
// truck-less plan to the remaining unplanned loads: that would guess its intent.
export function previewShipmentReconciliation(db: DatabaseSync, commessa?: string): ShipmentLinkDecision[] {
  const plans = (db.prepare("SELECT id,manualCommessa,manualCarico,actualDepartureDate FROM ShipmentPlans WHERE loadId IS NULL AND manualCommessa IS NOT NULL ORDER BY id").all() as unknown as ManualPlan[])
    .filter(plan => commessa === undefined || orderKey(plan.manualCommessa) === orderKey(commessa));
  const loads = db.prepare(`SELECT l.id,l.commessa,l.camion FROM Loads l
    WHERE l.stato<>'SPEDITO'
    AND NOT EXISTS(SELECT 1 FROM LoadingSessions s WHERE s.loadId=l.id AND (s.stato='SPEDITO' OR s.shippedAt IS NOT NULL))
    AND NOT EXISTS(SELECT 1 FROM ShipmentPlans p WHERE p.loadId=l.id AND p.actualDepartureDate IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM OperationalEvents e WHERE e.loadId=l.id AND e.type='PARTENZA_CONFERMATA')`).all() as unknown as ActiveLoad[];
  const occupied = new Set((db.prepare("SELECT loadId FROM ShipmentPlans WHERE loadId IS NOT NULL").all() as Array<{loadId:string}>).map(plan => plan.loadId));
  const decisions: ShipmentLinkDecision[] = plans.map(plan => {
    const candidates = loads.filter(load => orderKey(load.commessa) === orderKey(plan.manualCommessa) &&
      (!plan.manualCarico?.trim() || truckKey(load.camion) === truckKey(plan.manualCarico)));
    const candidate = candidates.length === 1 ? candidates[0]! : null;
    const reason = plan.actualDepartureDate ? "DEPARTED_PLAN" : !candidates.length ? "NO_MATCH" : candidates.length > 1 ? "AMBIGUOUS_LOADS" : occupied.has(candidate!.id) ? "LOAD_ALREADY_PLANNED" : "SUGGESTION";
    return {planId:plan.id,commessa:plan.manualCommessa,camion:plan.manualCarico,candidateLoadIds:candidates.map(load=>load.id),loadId:reason === "SUGGESTION" ? candidate!.id : null,reason};
  });
  for (const decision of decisions) {
    if (decision.reason !== "SUGGESTION") continue;
    // Also reject competing manual plans, regardless of their date or detail.
    if (decisions.some(other => other.planId !== decision.planId && other.reason !== "DEPARTED_PLAN" && other.candidateLoadIds.length === 1 && other.candidateLoadIds[0] === decision.loadId)) {
      decision.reason = "COMPETING_PLANS";
      decision.loadId = null;
    }
  }
  return decisions;
}

// Compatibility entry point: textual candidates are suggestions, never authority to write.
export function reconcileManualShipments(db: DatabaseSync, commessa?: string): ShipmentLinkDecision[] {
  return previewShipmentReconciliation(db, commessa);
}
