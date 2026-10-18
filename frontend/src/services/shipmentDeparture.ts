import type { ShipmentItem } from "./shipmentsApi";

export const shipmentHasDeparted = (item:ShipmentItem) => Boolean(item.actualDepartureDate || item.operationalStatus==="SPEDITO" || item.shipmentStatus==="IN_VIAGGIO" || item.shipmentStatus==="CONCLUSA");
