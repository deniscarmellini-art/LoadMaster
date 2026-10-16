import type { DatabaseSync } from "node:sqlite";
import type { DestinationType, LoadingSessionRecord } from "../models/operational.js";
import type { ShipmentTransportType } from "./shipmentRepository.js";
import { ApiError } from "../utils/apiError.js";

export interface LoadingSettings {
  operatorId: string;
  destinationType: DestinationType;
  trailerId?: string | undefined;
  carrierId?: string | undefined;
  transportMode?: ShipmentTransportType | null;
  transportDetailId?: string | null;
  transportDetailLabel?: string | null;
}

export function assignedTrailer(db:DatabaseSync,loadId:string):string|undefined {
  return (db.prepare("SELECT trailerId FROM TransportAssignments WHERE loadId=? AND releasedAt IS NULL AND stato IN ('IMPEGNATO','CARICATO') ORDER BY assignedAt DESC LIMIT 1").get(loadId) as {trailerId:string}|undefined)?.trailerId;
}

export function resolveLoadingTransport(db:DatabaseSync,loadId:string,input:LoadingSettings,previous?:LoadingSessionRecord):LoadingSettings {
  const mode=input.transportMode??null;
  const detail=mode==="BILICO_ESSEPI"?input.carrierId:input.transportDetailId;
  if((mode!=="BILICO_ESSEPI"&&input.carrierId)||(mode==="BILICO_ESSEPI"&&input.transportDetailId)||(!mode&&detail))
    throw new ApiError(400,"INVALID_TRANSPORT_DETAIL","Dettaglio incompatibile con la modalità di trasporto");
  let label:string|null=null;
  if(detail){
    const table=mode==="BILICO_ESSEPI"?"Carriers":mode==="RITIRA_CLIENTE"?"ClientVehicleTypes":"ThirdPartyTransportModes";
    const row=(db.prepare(`SELECT name,active FROM ${table} WHERE id=?`).get(detail) ?? (mode==="TERZI_PER_ESSEPI"?db.prepare("SELECT name,active FROM ClientVehicleTypes WHERE id=?").get(detail):undefined)) as {name:string;active:number}|undefined;
    const saved=previous?.transportMode===mode&&(mode==="BILICO_ESSEPI"?previous.carrierId:previous?.transportDetailId)===detail;
    if(!row||(!row.active&&!saved))throw new ApiError(400,"INVALID_TRANSPORT_DETAIL","Voce non attiva o incompatibile con la modalità di trasporto");
    label=saved?(previous?.transportDetailLabel??row.name):row.name;
  }
  if(mode!=="BILICO_ESSEPI" && assignedTrailer(db,loadId))
    throw new ApiError(409,"TRAILER_RELEASE_REQUIRED","Disimpegnare esplicitamente il rimorchio prima di cambiare modalit\u00e0. Il disimpegno non \u00e8 consentito dopo l'inizio del carico fisico.");
  return {...input,transportMode:mode,destinationType:mode==="BILICO_ESSEPI"?"RIMORCHIO_ESSEPI":"TRASPORTATORE",trailerId:mode==="BILICO_ESSEPI"?assignedTrailer(db,loadId):undefined,carrierId:mode==="BILICO_ESSEPI"?detail||undefined:undefined,transportDetailId:mode==="BILICO_ESSEPI"?null:detail||null,transportDetailLabel:label};
}
