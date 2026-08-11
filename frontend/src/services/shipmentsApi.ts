import { apiRequest } from "./apiClient";
export type ShipmentStatus="DA_PIANIFICARE"|"PIANIFICATA"|"PRONTA"|"IN_VIAGGIO"|"CONCLUSA";
export type ShipmentTransportType="BILICO_ESSEPI"|"TRASPORTATORE_ESTERNO";
export interface ShipmentItem{id:string;persisted:boolean;loadId:string|null;commessa:string;cliente:string;camion:string|null;plannedLoadingDate:string|null;plannedDepartureDate:string|null;originalPlannedDepartureDate:string|null;plannedDepartureDateChangedAt:string|null;actualDepartureDate:string|null;transportType:ShipmentTransportType|null;trailerId:string|null;carrierId:string|null;notes:string|null;shipmentStatus:ShipmentStatus;operationalStatus:string|null;createdAt:string|null;updatedAt:string|null;}
export interface ShipmentInput{loadId?:string|null;commessa:string;cliente:string;camion?:string|null;plannedLoadingDate?:string|null;plannedDepartureDate?:string|null;transportType?:ShipmentTransportType|null;trailerId?:string|null;carrierId?:string|null;notes?:string|null;}
export const listShipments=():Promise<ShipmentItem[]>=>apiRequest("/shipments");
export const createShipment=(input:ShipmentInput):Promise<ShipmentItem>=>apiRequest("/shipments",{method:"POST",body:JSON.stringify(input)});
export const updateShipment=(id:string,input:ShipmentInput):Promise<ShipmentItem>=>apiRequest(`/shipments/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(input)});
export const linkShipment=(id:string,loadId:string):Promise<ShipmentItem>=>apiRequest(`/shipments/${encodeURIComponent(id)}/link`,{method:"PATCH",body:JSON.stringify({loadId})});
export const departShipment=(id:string):Promise<ShipmentItem>=>apiRequest(`/shipments/${encodeURIComponent(id)}/depart`,{method:"POST"});
export const deleteShipment=(id:string):Promise<{success:boolean}>=>apiRequest(`/shipments/${encodeURIComponent(id)}`,{method:"DELETE"});
