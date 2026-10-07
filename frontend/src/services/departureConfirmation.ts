import type { CaricoCamion } from "../models/Loading";
import type { ShipmentItem } from "./shipmentsApi";
import type { TransportItem } from "./transportsApi";

export const departureTransport = (load?: CaricoCamion, plan?: ShipmentItem) => {
  const mode = load?.transportMode ?? plan?.transportType ?? null;
  return {
    mode,
    requiresCarrier: mode === "BILICO_ESSEPI",
    carrierId: mode === "BILICO_ESSEPI" ? load?.trasportatoreId ?? plan?.plannedCarrierId ?? "" : "",
    detailLabel: load?.transportMode ? load.transportDetailLabel ?? "" : plan?.transportDetailLabel ?? "",
  };
};

export const departureTrailerId = (load: CaricoCamion | undefined, transports: readonly TransportItem[]) => {
  if (!load) return undefined;
  const normalized = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "");
  return transports.find(item =>
    (item.status === "IMPEGNATO" || item.status === "CARICATO") &&
    (item.loadId === load.backendLoadId || (!item.loadId &&
      normalized(item.commessa ?? "") === normalized(load.commessa) &&
      normalized(item.camion ?? "") === normalized(load.camion))),
  )?.id;
};

// Keep the dialog open until both persistence and the authoritative refresh succeed.
export async function confirmDeparture(
  operation: () => Promise<unknown>,
  close: () => void,
  showError: (message: string) => void,
): Promise<void> {
  try {
    await operation();
    close();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Conferma partenza non riuscita. Riprovare.");
  }
}
