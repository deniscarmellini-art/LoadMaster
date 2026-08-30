import { apiRequest } from "./apiClient";

export type TransportStatus = "DISPONIBILE" | "IMPEGNATO" | "CARICATO" | "IN_VIAGGIO" | "FUORI_SERVIZIO";
export type AssignmentSource = "MANUAL" | "LOAD";
export interface ManualReservationInput { commessa:string; cliente:string; carico:string; plannedDepartureDate?:string|null; }

export interface TransportItem {
  id: string;
  plate: string;
  description: string;
  active: boolean;
  status: TransportStatus;
  source: AssignmentSource | null;
  assignmentId: string | null;
  loadId: string | null;
  commessa: string | null;
  cliente: string | null;
  camion: string | null;
  plannedDepartureDate: string | null;
  departedAt: string | null;
  availableFrom: string | null;
  nextInspectionDate: string | null;
  disabledReason: string | null;
  loadingSessionId: string | null;
}

export const listTransports = (): Promise<TransportItem[]> => apiRequest("/transports");
export const createTransportReservation = (id:string,input:ManualReservationInput):Promise<TransportItem> => apiRequest(`/trailers/${encodeURIComponent(id)}/reservation`,{method:"POST",body:JSON.stringify(input)});
export const updateTransportReservation = (id:string,input:ManualReservationInput):Promise<TransportItem> => apiRequest(`/trailers/${encodeURIComponent(id)}/reservation`,{method:"PUT",body:JSON.stringify(input)});
export const updatePlannedDeparture = (id:string,plannedDepartureDate:string|null):Promise<TransportItem> => apiRequest(`/trailers/${encodeURIComponent(id)}/planned-departure`,{method:"PATCH",body:JSON.stringify({plannedDepartureDate})});
export const releaseTransportReservation = (id:string):Promise<TransportItem> => apiRequest(`/trailers/${encodeURIComponent(id)}/reservation`,{method:"DELETE"});
export const disableTrailer = (id: string, reason: string, notes: string): Promise<TransportItem> =>
  apiRequest(`/trailers/${encodeURIComponent(id)}/disable`, { method: "POST", body: JSON.stringify({ reason, notes }) });
export const enableTrailer = (id: string): Promise<TransportItem> =>
  apiRequest(`/trailers/${encodeURIComponent(id)}/enable`, { method: "POST" });
export const updateTrailerInspection = (id: string, nextInspectionDate: string | null): Promise<TransportItem> =>
  apiRequest(`/trailers/${encodeURIComponent(id)}/inspection`, { method: "PATCH", body: JSON.stringify({ nextInspectionDate }) });
