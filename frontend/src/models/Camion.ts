export type StatoCamion =
  | "Non completa"
  | "Completa da caricare"
  | "In carico"
  | "Attesa ritiro"
  | "Evasa";

export interface Camion {
  id: string;

  commessa: string;
  cliente: string;
  camion: string;

  previsti: number;
  pronti: number;
  caricati: number;
  mancanti: number;

  peso: number;
  volume: number;

  stato: StatoCamion;
}