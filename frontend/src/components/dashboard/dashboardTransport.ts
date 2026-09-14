import type { Trasportatore } from "../../models/Settings";
import type { ShipmentItem } from "../../services/shipmentsApi";
import type { TransportItem } from "../../services/transportsApi";
import { demoBranding } from "../../services/demoBranding";

export interface DashboardTransportPresentation {
  label: string;
  transport: string;
  trailer: string | null;
  carrier: string | null;
  plannedCarrier?: string | null;
}

const emptyPresentation: DashboardTransportPresentation = {
  label: "—",
  transport: "—",
  trailer: null,
  carrier: null,
};

export const dashboardTransportPresentation = (
  shipment: ShipmentItem | undefined,
  transports: TransportItem[],
  carriers: Trasportatore[],
): DashboardTransportPresentation => {
  if (!shipment?.transportType) return emptyPresentation;
  const transportType: string = shipment.transportType;

  if (transportType === "RITIRO_CLIENTE" || (transportType === "TRASPORTATORE_ESTERNO" && !shipment.carrierId)) {
    return {
      label: "Ritiro cliente",
      transport: "Ritiro cliente",
      trailer: null,
      carrier: null,
    };
  }

  if (transportType === "BILICO_ESSEPI") {
    const trailer = transports.find(
          (item) =>
            item.assignmentId !== null &&
            (shipment.loadId ? item.loadId === shipment.loadId :
              item.source === "MANUAL" && item.commessa?.trim().toUpperCase() === shipment.commessa.trim().toUpperCase() &&
              (item.camion??"").replace(/[\s-]+/g,"").toUpperCase() === (shipment.camion??"").replace(/[\s-]+/g,"").toUpperCase()),
        );
    return {
      label: trailer ? `${demoBranding.bilico} · ${trailer.plate}` : demoBranding.bilico,
      transport: demoBranding.bilico,
      trailer: trailer?.plate ?? null,
      carrier: null,
      plannedCarrier: carriers.find(item=>item.id===shipment.plannedCarrierId)?.nome ?? null,
    };
  }

  const carrier = shipment.carrierId
    ? carriers.find((item) => item.id === shipment.carrierId)?.nome ?? null
    : null;
  return {
    label: carrier ? `Esterno · ${carrier}` : "Trasportatore esterno",
    transport: "Trasportatore esterno",
    trailer: null,
    carrier,
  };
};
