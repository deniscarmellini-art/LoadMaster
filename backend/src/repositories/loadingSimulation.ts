import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "../utils/apiError.js";
import { panelQrText, packageQrText } from "../utils/labelQr.js";
import type { SimulationCandidate } from "../models/loadingSimulation.js";

/** Read-only label generation. Loading is always performed by the normal /units API. */
export function loadingSimulationCandidates(db:DatabaseSync,sessionId:string):SimulationCandidate[] {
  const session=db.prepare("SELECT s.loadId,s.stato,s.shippedAt,l.commessa,l.cliente,l.camion,l.stato loadStatus FROM LoadingSessions s JOIN Loads l ON l.id=s.loadId WHERE s.id=?").get(sessionId) as
    {loadId:string;stato:string;shippedAt:string|null;commessa:string;cliente:string;camion:string;loadStatus:string}|undefined;
  if(!session)throw new ApiError(404,"RESOURCE_NOT_FOUND","Sessione di carico non trovata");
  if(session.shippedAt||session.loadStatus==="SPEDITO"||!["DA_COMPLETARE","DA_CARICARE","IN_CARICO"].includes(session.stato))return [];
  const panels=db.prepare(`SELECT p.* FROM Panels p WHERE p.loadId=? AND p.stato='DISPONIBILE' AND p.packageId IS NULL
    AND NOT EXISTS(SELECT 1 FROM LoadingUnits u WHERE u.panelId=p.id AND u.active=1) ORDER BY p.numeroPannello,p.id`).all(session.loadId);
  const packages=db.prepare(`SELECT k.id,k.codicePacco,COUNT(p.id) elements,SUM(p.peso) weight,SUM(p.volume) volume FROM Packages k JOIN Panels p ON p.packageId=k.id
    WHERE k.loadId=? AND k.stato='DISPONIBILE'
    AND NOT EXISTS(SELECT 1 FROM LoadingUnits u WHERE u.packageId=k.id AND u.active=1)
    AND NOT EXISTS(SELECT 1 FROM Panels c WHERE c.packageId=k.id AND (c.loadId<>k.loadId OR c.stato<>'DISPONIBILE' OR EXISTS(SELECT 1 FROM LoadingUnits u WHERE u.panelId=c.id AND u.active=1)))
    GROUP BY k.id ORDER BY k.codicePacco,k.id`).all(session.loadId);
  return [
    ...panels.map(p=>({id:String(p.id),type:"PANEL" as const,code:String(p.numeroPannello),elements:1,qr:panelQrText({commessa:session.commessa,cliente:session.cliente,camion:session.camion,numeroPannello:String(p.numeroPannello),spessore:Number(p.spessore),lunghezza:Number(p.lunghezza),altezza:Number(p.altezza),peso:Number(p.peso)})})),
    ...packages.map(p=>({id:String(p.id),type:"PACKAGE" as const,code:String(p.codicePacco),elements:Number(p.elements),qr:packageQrText(String(p.codicePacco),session.commessa,session.cliente,session.camion,Number(p.elements),Number(p.weight),Number(p.volume))})),
  ];
}
