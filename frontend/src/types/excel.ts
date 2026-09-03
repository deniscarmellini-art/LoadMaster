export interface Pannello {
  backendId?: string;
  loadId?: string;
  loadStatus?: "DA_COMPLETARE" | "DA_CARICARE" | "IN_CARICO" | "ATTESA_SPEDIZIONE" | "SPEDITO";
  packageId?: string;
  manualLocation?: string;
  scannedAt?: string;
  scannedByOperatorId?: string;
  numeroPannello: string;
  numeroCliente: string;
  numeroMasterPanel: string;
  numeroCamion: string;

  lato1: string;
  lato2: string;

  tipoPannello: string;

  quantita: number;

  spessore: number;
  lunghezza: number;
  altezza: number;

  superficie: number;
  volume: number;
  peso: number;

  // Stato Preparazione
  preparato: boolean;

  // Stato Carico
  caricato: boolean;
  spedito?: boolean;
}

export interface Commessa {
  ordine: string;
  cliente: string;
  numeroCliente: string;
  riferimento: string;

  pannelli: Pannello[];
}





























































