import { apiRequest } from "./apiClient";

export type TransportStatus = "DISPONIBILE" | "IMPEGNATO" | "IN_VIAGGIO" | "FUORI_SERVIZIO";

export interface TransportItem {
  id: string;
  plate: string;
  description: string;
  active: boolean;
  status: TransportStatus;
  commessa: string | null;
  cliente: string | null;
  camion: string | null;
  departedAt: string | null;
  availableFrom: string | null;
  nextInspectionDate: string | null;
  disabledReason: string | null;
  loadingSessionId: string | null;
}

export const listTransports = (): Promise<TransportItem[]> => apiRequest("/transports");
export const disableTrailer = (id: string, reason: string, notes: string): Promise<TransportItem> =>
  apiRequest(`/trailers/${encodeURIComponent(id)}/disable`, { method: "POST", body: JSON.stringify({ reason, notes }) });
export const enableTrailer = (id: string): Promise<TransportItem> =>
  apiRequest(`/trailers/${encodeURIComponent(id)}/enable`, { method: "POST" });
export const updateTrailerInspection = (id: string, nextInspectionDate: string | null): Promise<TransportItem> =>
  apiRequest(`/trailers/${encodeURIComponent(id)}/inspection`, { method: "PATCH", body: JSON.stringify({ nextInspectionDate }) });
