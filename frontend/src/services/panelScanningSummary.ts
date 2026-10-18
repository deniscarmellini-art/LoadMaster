import type { Camion } from "../models/Camion";
import type { Commessa } from "../types/excel";

export interface PanelScanningSummaryData {
  target: Pick<Camion, "cliente" | "commessa" | "camion">;
  commessa: Pick<Commessa, "riferimento">;
  expected: number;
  available: number;
  missing: number;
  packages: number;
}

export function panelScanningSummaryFields(data: PanelScanningSummaryData): [string, string | number][] {
  const display = (value: string | undefined) => value?.trim() || "—";
  return [
    ["Cliente", display(data.target.cliente)],
    ["Riferimento ordine", display(data.commessa.riferimento)],
    ["Commessa", display(data.target.commessa)],
    ["Camion", display(data.target.camion)],
    ["Previsti", data.expected],
    ["Disponibili", data.available],
    ["Mancanti", data.missing],
    ["Pacchi creati", data.packages],
  ];
}
