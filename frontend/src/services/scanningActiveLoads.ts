import type { Camion } from "../models/Camion";
import type { Pacco } from "../models/Scanning";
import type { Commessa } from "../types/excel";

/** Scanning-list presentation only: availability counters do not certify a scan. */
export function scanningActiveLoads(rows:Camion[],commesse:Commessa[],packages:Pacco[]):Camion[] {
  const closedPackages=new Set(packages.filter(pack=>pack.stato!=="APERTO"&&pack.id).map(pack=>pack.id));
  return rows.filter(row=>{
    if(row.stato==="Attesa spedizione"||row.stato==="Partita")return false;
    const panels=commesse.filter(order=>order.ordine===row.commessa).flatMap(order=>order.pannelli)
      .filter(panel=>panel.loadId?panel.loadId===row.id:panel.numeroCamion===row.camion);
    // Incomplete local data must not hide a load still expecting elements.
    if(panels.length<row.previsti)return true;
    return panels.some(panel=>!panel.scannedAt?.trim()
      || (!panel.preparato&&!panel.caricato)
      || (panel.packageId&&!closedPackages.has(panel.packageId)));
  });
}
