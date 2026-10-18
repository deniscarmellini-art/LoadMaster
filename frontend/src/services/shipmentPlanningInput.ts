import type { ShipmentInput } from "./shipmentsApi";

/** Calendar predictions only; actual carrier/assignments belong to loading operations. */
export function normalizeShipmentPlanningInput(input:ShipmentInput):ShipmentInput {
  return input.transportType==="RITIRA_CLIENTE"
    ? {...input,plannedCarrierId:null,carrierId:null,vehicleTypeId:null}
    : input;
}
