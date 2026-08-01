import type { Pannello } from "../types/excel";

export type StatoPannelloScansione = "MANCANTE" | "IN_LAVORAZIONE_PACCO" | "DISPONIBILE" | "CARICATO" | "SPEDITO";
export type StatoPacco = "APERTO" | "DISPONIBILE" | "CARICATO" | "SPEDITO";

export interface UnitaSingola {
  tipo: "SINGOLO";
  commessa: string;
  camion: string;
  numeroPannello: string;
  operatore: string;
  operatoreId?: string;
  chiusaIl: string;
}

export interface Pacco {
  codice: string;
  stato: StatoPacco;
  commessa: string;
  cliente: string;
  camion: string;
  pannelli: Pannello[];
  numeroPezzi: number;
  pesoTotale: number;
  volumeTotale: number;
  operatore: string;
  operatoreId?: string;
  chiusoIl: string;
}
