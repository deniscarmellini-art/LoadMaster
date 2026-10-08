import { apiRequest } from "./apiClient";
import type { ShipmentDocument } from "../models/ShipmentDocument";
export const getShipmentDocument=(id:string,signal:AbortSignal)=>apiRequest<ShipmentDocument>(`/history/${encodeURIComponent(id)}/document`,{signal});
