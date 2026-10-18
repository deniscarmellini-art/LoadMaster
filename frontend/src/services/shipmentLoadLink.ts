import type { ShipmentItem } from "./shipmentsApi";

// A matching order/truck is never evidence of a planning relationship.
export function linkedShipmentForLoad(items: readonly ShipmentItem[], loadId: string | null | undefined) {
  const matches = loadId ? items.filter(item => item.persisted && item.loadId === loadId) : [];
  return {
    plan: matches.length === 1 ? matches[0] : undefined,
    problem: matches.length > 1
      ? "Più pianificazioni collegate allo stesso carico: impossibile scegliere i dati della spedizione."
      : matches.length === 0
        ? "Nessuna pianificazione collegata al carico. I dati delle pianificazioni manuali non vengono utilizzati."
        : null,
  };
}

export function shipmentLoadLinkLabel(item: Pick<ShipmentItem, "loadId" | "camion">): string {
  return item.loadId
    ? `Collegata al carico ${item.camion?.trim() || "(numero non disponibile)"} · ID: ${item.loadId}`
    : "Manuale non collegata";
}
