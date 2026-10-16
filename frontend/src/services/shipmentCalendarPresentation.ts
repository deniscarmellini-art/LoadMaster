import type { ShipmentItem } from "./shipmentsApi";
import type { CaricoCamion } from "../models/Loading";
import type { Rimorchio, Trasportatore, VoceTrasporto } from "../models/Settings";
import type { TransportItem } from "./transportsApi";
import { shipmentListDetails } from "./shipmentListPresentation";

const present = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "—" ? trimmed : undefined;
};

export function shipmentCalendarTransportDetails(
  item: ShipmentItem,
  carriers: readonly Trasportatore[],
  vehicleTypes: readonly VoceTrasporto[],
  trailers: readonly Rimorchio[],
  transports: readonly TransportItem[],
  loads: readonly CaricoCamion[] = [],
): string {
  if (item.transportType === "TERZI_PER_ESSEPI") {
    return [
      present(carriers.find(carrier => carrier.id === item.plannedCarrierId)?.nome),
      present(vehicleTypes.find(type => type.id === item.vehicleTypeId)?.nome),
    ].filter(Boolean).join(" · ");
  }
  if (item.transportType === "BILICO_ESSEPI") {
    const details = shipmentListDetails(item, carriers, trailers, transports, loads);
    if (details.mode !== "BILICO_ESSEPI") return "";
    return [present(details.party), present(details.plate)].filter(Boolean).join(" · ");
  }
  return "";
}
