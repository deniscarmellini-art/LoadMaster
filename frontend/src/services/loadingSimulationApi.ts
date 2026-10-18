import { apiRequest } from "./apiClient";
export type { SimulationCandidate } from "../../../backend/src/models/loadingSimulation";
import type { SimulationCandidate } from "../../../backend/src/models/loadingSimulation";

export async function listSimulationCandidates(sessionId:string):Promise<SimulationCandidate[]> {
  if(import.meta.env.VITE_SISLOG_TEST!==true)throw new Error("Simulatore disponibile esclusivamente in TEST");
  return apiRequest(`/loading-sessions/${encodeURIComponent(sessionId)}/test-qr-candidates`);
}
