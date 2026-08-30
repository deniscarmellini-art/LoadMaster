import type { Trasportatore } from "../../models/Settings";
import type { ShipmentItem } from "../../services/shipmentsApi";
import type { TransportItem } from "../../services/transportsApi";

export interface DashboardTransportPresentation {
  label: string;
  transport: string;
  trailer: string | null;
  carrier: string | null;
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

  if (transportType === "RITIRO_CLIENTE") {
    return {
      label: "Ritiro cliente",
      transport: "Ritiro cliente",
      trailer: null,
      carrier: null,
    };
  }

  if (transportType === "BILICO_ESSEPI") {
    const trailer = shipment.loadId
      ? transports.find(
          (item) =>
            item.assignmentId !== null &&
            item.loadId === shipment.loadId,
        )
      : undefined;
    const trailerLabel = trailer?.plate ?? "Da assegnare";
    return {
      label: `Bilico Essepi · ${trailerLabel}`,
      transport: "Bilico Essepi",
      trailer: trailer?.plate ?? null,
      carrier: null,
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
