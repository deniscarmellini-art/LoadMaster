import type { ShipmentItem } from "./shipmentsApi";
import type { TransportItem } from "./transportsApi";
import type { CaricoCamion } from "../models/Loading";
import type { Rimorchio, Trasportatore, VoceTrasporto } from "../models/Settings";
import { normalizeOrder, normalizeTruck } from "../utils/loadIdentity";

const text = (value: string | null | undefined) => value?.trim() || "—";
const orderKey = (value: string | null) => normalizeOrder(value).toLocaleUpperCase("it-IT");
const truckKey = (value: string | null) => normalizeTruck(value).replace(/-/g, "");

export function shipmentListDetails(
  item: ShipmentItem,
  carriers: readonly Trasportatore[],
  trailers: readonly Rimorchio[],
  transports: readonly TransportItem[],
  loads: readonly CaricoCamion[] = [],
  vehicleTypes: readonly VoceTrasporto[] = [],
) {
  const load = item.loadId ? loads.find(load => load.backendLoadId === item.loadId) : undefined;
  const mode = load?.transportMode ?? item.transportType;
  const actualCarrier = load && (!load.transportMode || load.transportMode === mode) ? load.trasportatoreId : undefined;
  const plannedCarrier = mode === item.transportType
    ? item.carrierId ?? (mode === "BILICO_ESSEPI" ? item.plannedCarrierId ?? item.transportDetailId : null)
    : null;
  const carrierId = mode === "TERZI_PER_ESSEPI"
    ? (mode === item.transportType ? item.plannedCarrierId : null) ?? actualCarrier
    : actualCarrier ?? plannedCarrier;
  const carrierName = carriers.find(carrier => carrier.id === carrierId)?.nome;
  const party = mode === "TERZI_PER_ESSEPI"
    // The planning selection is authoritative, including an explicitly empty value.
    ? (carrierId ? text(carrierName) : text(item.transportType === mode ? item.transportDetailLabel : load?.transportDetailLabel))
    : mode === "RITIRA_CLIENTE" ? (carrierId ? text(carrierName) : text(item.cliente))
    : mode === "BILICO_ESSEPI" ? text(carrierName) : "—";

  let plate = "—";
  if (mode === "BILICO_ESSEPI") {
    const assignments = transports.filter(transport => transport.assignmentId &&
      ["IMPEGNATO", "CARICATO", "IN_VIAGGIO"].includes(transport.status) &&
      (item.loadId ? transport.loadId === item.loadId :
        !transport.loadId && transport.source === "MANUAL" && !!item.camion?.trim() &&
        orderKey(transport.commessa) === orderKey(item.commessa) &&
        truckKey(transport.camion) === truckKey(item.camion)));
    if (assignments.length === 1) plate = text(assignments[0]!.plate);
    else if (!assignments.length) {
      const id = item.trailerId ?? load?.rimorchioId;
      const transport = transports.find(transport => transport.id === id);
      // A cached plan/session must not reuse a trailer now assigned to another load.
      const reassigned = transport?.assignmentId && (transport.loadId ? transport.loadId !== item.loadId :
        orderKey(transport.commessa) !== orderKey(item.commessa) || truckKey(transport.camion) !== truckKey(item.camion));
      const released = transport && (!transport.assignmentId || !["IMPEGNATO", "CARICATO", "IN_VIAGGIO"].includes(transport.status));
      if (!reassigned && !released && id) plate = text(transport?.plate || trailers.find(trailer => trailer.id === id)?.targa);
    }
  }
  let vehicleType = "—";
  if (mode === "TERZI_PER_ESSEPI" && mode === item.transportType) {
    vehicleType = text(vehicleTypes.find(type => type.id === item.vehicleTypeId)?.nome);
  } else if (mode === "RITIRA_CLIENTE") {
    const actual = load?.transportMode === mode && Boolean(load.transportDetailId || load.transportDetailLabel?.trim());
    const planned = mode === item.transportType;
    const id = actual ? load?.transportDetailId : planned ? item.transportDetailId : null;
    const label = actual ? load?.transportDetailLabel : planned ? item.transportDetailLabel : null;
    vehicleType = text(vehicleTypes.find(type => type.id === id)?.nome || label);
  }
  return {mode, party, carrierId, vehicleType, plate, address:text(item.deliveryAddress), notes:text(item.notes)};
}
