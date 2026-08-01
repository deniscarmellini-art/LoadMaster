export type StatoCamion =
  | "Da completare"
  | "Da caricare"
  | "In carico"
  | "Attesa spedizione"
  | "Partita";

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
