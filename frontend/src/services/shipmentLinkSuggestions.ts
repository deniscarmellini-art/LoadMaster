import type { ShipmentItem } from "./shipmentsApi";

const orderKey = (value: string) => value.trim().toUpperCase();
const departed = (item: ShipmentItem) => Boolean(item.actualDepartureDate || item.operationalStatus === "SPEDITO" || item.shipmentStatus === "IN_VIAGGIO" || item.shipmentStatus === "CONCLUSA");

// Text only helps the operator find candidates. Confirmation always sends the ID.
export function shipmentLinkSuggestions(plan: ShipmentItem, items: readonly ShipmentItem[]): ShipmentItem[] {
  if (!plan.persisted || plan.loadId || departed(plan)) return [];
  const occupied = new Set(items.filter(item => item.persisted && item.loadId).map(item => item.loadId));
  return [...new Map(items.filter(item => !item.persisted && item.loadId && !departed(item)
    && !occupied.has(item.loadId) && orderKey(item.commessa) === orderKey(plan.commessa))
    .map(item => [item.loadId, item])).values()];
}
