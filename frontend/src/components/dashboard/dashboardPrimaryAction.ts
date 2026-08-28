import type { Camion } from "../../models/Camion";

export interface DashboardPrimaryHandlers {
  onConfirmDeparture: (row: Camion) => void;
  onContinueLoad: (row: Camion) => void;
  onOpenHistory: (row: Camion) => void;
  onOpenScanning: (row: Camion) => void;
  onStartLoad: (row: Camion) => void;
}

export function runDashboardPrimaryAction(row: Camion, handlers: DashboardPrimaryHandlers) {
  if (row.stato === "Da completare") handlers.onOpenScanning(row);
  else if (row.stato === "Da caricare") handlers.onStartLoad(row);
  else if (row.stato === "In carico") handlers.onContinueLoad(row);
  else if (row.stato === "Attesa spedizione") handlers.onConfirmDeparture(row);
  else if (row.stato === "Partita") handlers.onOpenHistory(row);
}

export function dashboardPrimaryLabel(row: Camion) {
  if (row.stato === "Da completare") return "Scansione pannelli";
  if (row.stato === "Da caricare") return "Carico camion";
  if (row.stato === "In carico") return "Continua carico";
  if (row.stato === "Attesa spedizione") return "Conferma partenza";
  if (row.stato === "Partita") return "Apri storico";
  return "Apri";
}
