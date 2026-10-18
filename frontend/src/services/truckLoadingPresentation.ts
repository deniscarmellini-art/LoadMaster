import type { StatoCaricoOperativo } from "../models/Loading";

export function truckLoadingActionLabel(status:StatoCaricoOperativo):string {
  switch(status){
    case "DA_CARICARE":return "Avvia carico";
    case "DA_COMPLETARE":case "IN_CARICO":return "Continua carico";
    case "ATTESA_SPEDIZIONE":return "Visualizza carico";
    case "SPEDITO":return "Visualizza carico";
  }
}

export function truckLoadingProgressMessage(status:StatoCaricoOperativo,confirmedAt:string|null|undefined,allLoaded:boolean):string|null {
  if(status==="ATTESA_SPEDIZIONE")return confirmedAt
    ? "Carico completato — in attesa della partenza"
    : "Tutti gli elementi caricati — pronto per la chiusura";
  return status==="IN_CARICO"&&allLoaded?"Tutti gli elementi caricati — pronto per la chiusura":null;
}
