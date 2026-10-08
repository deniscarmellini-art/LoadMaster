import type { LoadingRepository } from "../repositories/loadingRepository.js";
import { ApiError } from "../utils/apiError.js";
import type { TransportRepository } from "../repositories/transportRepository.js";

import type { LoadingSettings as Settings } from "../repositories/loadingTransport.js";
import type { LoadingSessionRecord } from "../models/operational.js";
import {decodeLoadingQr,offlineLines,offlineCounts,type OfflineQrRow} from './offlineQr.js';
export class LoadingService{
 constructor(private readonly repo:LoadingRepository,private readonly transports?:TransportRepository){}
 list(){return this.repo.list();}
 get(id:string){const value=this.repo.find(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Sessione non trovata");return value;}
 byLoad(loadId:string){const value=this.repo.findByLoad(loadId);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Sessione non trovata");return value;}
 create(loadId:string,input:Settings){return this.repo.transaction(()=>{if(input.transportMode!==undefined)input=this.repo.resolveTransport(loadId,input);else this.validateDestination(input);const existing=this.repo.findByLoad(loadId);if(existing)return existing;this.validateTrailer(input,loadId);return this.repo.create(loadId,input);});}
 update(id:string,input:Settings){return this.repo.transaction(()=>{const session=this.get(id);if(session.shippedAt||session.stato==="SPEDITO")throw new ApiError(409,"SESSION_CLOSED","Carico già spedito");if(input.transportMode===undefined&&session.transportMode)input={...input,transportMode:session.transportMode,transportDetailId:session.transportDetailId,carrierId:input.carrierId??session.carrierId??undefined};if(input.transportMode!==undefined)input=this.repo.resolveTransport(session.loadId,input,session);else this.validateDestination(input);this.validateTrailer(input,session.loadId);return this.repo.update(id,input);});}
 addUnit(id:string,input:{unitType:"PANEL"|"PACKAGE";panelId?:string;packageId?:string;operatorId:string}){return this.repo.transaction(()=>this.addUnitLocked(id,input));}
 private addUnitLocked(id:string,input:{unitType:"PANEL"|"PACKAGE";panelId?:string;packageId?:string;operatorId:string}){const session=this.get(id);if(!["DA_COMPLETARE","DA_CARICARE","IN_CARICO"].includes(session.stato))throw new ApiError(409,"SESSION_CLOSED","Carico già chiuso");const unitId=input.unitType==="PANEL"?input.panelId:input.packageId;if(!unitId)throw new ApiError(400,"VALIDATION_ERROR","Unità non valida");const info=this.repo.unitInfo(input.unitType,unitId);if(!info||info.loadId!==session.loadId||info.stato!=="DISPONIBILE"||info.packageId)throw new ApiError(409,"UNIT_NOT_AVAILABLE","Unità non disponibile");return this.repo.addUnit(id,input);}
 private offlineRow(id:string,raw:string,line:number,operatorId:string):OfflineQrRow {
  const qr=decodeLoadingQr(raw);const row:OfflineQrRow={line,raw,type:qr?.type??null,code:qr?.code??'—',commessa:qr?.commessa??'—',camion:qr?.camion??'—',elements:0,status:'ERROR',message:'QR non valido'};
  if(!qr)return row;
  const session=this.repo.offlineSession(id);if(!session)throw new ApiError(404,'RESOURCE_NOT_FOUND','Sessione non trovata');
  if(!this.repo.isActiveOperator(operatorId))return {...row,message:'Operatore non attivo'};
  if(qr.commessa!==session.commessa||qr.camion!==session.camion)return {...row,message:'Commessa o camion diversi dal carico selezionato'};
  const unit=this.repo.offlineUnit(qr.type,qr.code,session.loadId);if(!unit||unit.loadId!==session.loadId)return {...row,message:'Unità non prevista nel database'};
  row.unitId=unit.id;row.elements=unit.elements;
  if(unit.packageId)return {...row,message:'Elemento appartenente a un pacco: caricare il QR del pacco'};
  if(unit.stato==='CARICATO')return {...row,status:'ALREADY_LOADED',message:'Unità già caricata'};
  if(session.shippedAt||session.stato==='SPEDITO'||unit.stato==='SPEDITO')return {...row,message:'Carico o unità già spediti'};
  if(!['DA_COMPLETARE','DA_CARICARE','IN_CARICO'].includes(session.stato))return {...row,message:'Carico chiuso'};
  if(unit.stato!=='DISPONIBILE'||!unit.elements)return {...row,message:'Unità non disponibile'};
  return {...row,status:'VALID',message:'Caricabile'};
 }
 offline(id:string,input:{text:string;operatorId:string},confirm=false){
  if(!this.repo.offlineSession(id))throw new ApiError(404,'RESOURCE_NOT_FOUND','Sessione non trovata');
  const lines=offlineLines(input.text);if(!lines.length||lines.length>2000)throw new ApiError(400,'VALIDATION_ERROR','Inserire da 1 a 2000 scansioni');
  const seen=new Set<string>();const rows=lines.map((raw,index)=>{const row=this.offlineRow(id,raw,index+1,input.operatorId);const qr=decodeLoadingQr(raw);if(qr){const key=JSON.stringify(qr);if(seen.has(key))return {...row,status:'DUPLICATE' as const,message:'Duplicato nel trasferimento'};seen.add(key);}return row;});
  if(confirm)for(let i=0;i<rows.length;i++){
   if(rows[i]!.status!=='VALID')continue;
   try{rows[i]=this.repo.transaction(()=>{const row=this.offlineRow(id,lines[i]!,i+1,input.operatorId);if(row.status!=='VALID')return row;this.addUnitLocked(id,{unitType:row.type!,...(row.type==='PANEL'?{panelId:row.unitId!}:{packageId:row.unitId!}),operatorId:input.operatorId});return {...row,status:'LOADED',message:'Caricato'};});}
   catch(error){rows[i]={...rows[i]!,status:'ERROR',message:error instanceof ApiError?error.message:'Registrazione non riuscita; unità non caricata'};}
  }
  return {rows,counts:offlineCounts(rows),...(confirm?{session:this.repo.offlineResultSession(id)}:{})};
 }
 removeUnit(id:string,unitId:string,input:{operatorId:string}){const session=this.get(id);if(!["IN_CARICO","ATTESA_SPEDIZIONE"].includes(session.stato))throw new ApiError(409,"SESSION_CLOSED","Carico non modificabile");return this.repo.transaction(()=>this.repo.removeUnit(id,unitId,input.operatorId));}
 complete(id:string){const session=this.get(id);if(session.stato==="SPEDITO")throw new ApiError(409,"SESSION_CLOSED","Carico già spedito");this.validateCompletion(session);if(session.destinationType!=="RIMORCHIO_ESSEPI"||!session.trailerId)throw new ApiError(409,"INVALID_DESTINATION","Rimorchio obbligatorio");if(!this.repo.isComplete(id,session.loadId))throw new ApiError(409,"LOADING_INCOMPLETE","Carico incompleto");return this.repo.transaction(()=>this.repo.complete(id));}
 reopen(id:string,input:{note?:string}){const session=this.get(id);if(session.stato!=="ATTESA_SPEDIZIONE")throw new ApiError(409,"INVALID_STATUS","Solo un carico in attesa può essere riaperto");return this.repo.transaction(()=>this.repo.reopen(id,input.note));}
 ship(id:string,input:{carrierId?:string;operatorId?:string;transportMode?:LoadingSessionRecord["transportMode"];transportDetailId?:string|null}){
  return this.repo.transaction(()=>{
   let session=this.get(id);
   if(!["IN_CARICO","ATTESA_SPEDIZIONE"].includes(session.stato))throw new ApiError(409,"INVALID_STATUS","Carico non spedibile oppure spedito");
   if(input.operatorId&&!this.repo.isActiveOperator(input.operatorId))throw new ApiError(400,"INVALID_OPERATOR","Selezionare un operatore attivo per la partenza");
   if(!session.transportMode&&input.transportMode){
    const settings=this.repo.resolveTransport(session.loadId,{operatorId:session.operatorId,destinationType:session.destinationType,transportMode:input.transportMode,transportDetailId:input.transportDetailId??null,carrierId:input.carrierId},session);
    session=this.repo.update(id,settings);
   }
   const carrierId=input.carrierId??session.carrierId;
   if(session.transportMode){
    this.validateCompletion(session);
    if(input.carrierId)this.repo.resolveTransport(session.loadId,{operatorId:session.operatorId,destinationType:session.destinationType,transportMode:session.transportMode,carrierId:input.carrierId,transportDetailId:session.transportDetailId},session);
    if(session.transportMode!=="BILICO_ESSEPI"&&input.carrierId)throw new ApiError(400,"INVALID_TRANSPORT_DETAIL","Trasportatore incompatibile");
   }else if(!carrierId)throw new ApiError(400,"VALIDATION_ERROR","Trasportatore obbligatorio");
   if(!this.repo.isComplete(id,session.loadId))throw new ApiError(409,"LOADING_INCOMPLETE","Carico incompleto");
   if(session.transportMode&&input.carrierId){const resolved=this.repo.resolveTransport(session.loadId,{operatorId:session.operatorId,destinationType:session.destinationType,transportMode:session.transportMode,carrierId:input.carrierId,transportDetailId:session.transportDetailId},session);this.repo.update(id,resolved);}
   return this.repo.ship(id,carrierId??undefined,input.operatorId??session.operatorId);
  });
 }

 private validateCompletion(session:ReturnType<LoadingService["get"]>){
  if(!session.transportMode)return; // Existing sessions retain their legacy completion rules.
  if(session.transportMode==="BILICO_ESSEPI"){
    if(!session.carrierId)throw new ApiError(400,"VALIDATION_ERROR","Trasportatore Essepi effettivo obbligatorio");
    if(!session.trailerId||this.repo.assignedTrailer(session.loadId)!==session.trailerId)throw new ApiError(409,"INVALID_DESTINATION","Assegnare il Rimorchio Essepi da Carico camion o Trasporti");
  }
  if(session.transportMode==="TERZI_PER_ESSEPI"&&!session.transportDetailId)throw new ApiError(400,"VALIDATION_ERROR","Modalità Terzi per Essepi obbligatoria");
  this.repo.resolveTransport(session.loadId,{operatorId:session.operatorId,destinationType:session.destinationType,transportMode:session.transportMode,carrierId:session.carrierId??undefined,transportDetailId:session.transportDetailId},session);
 }
 private validateDestination(input:Settings){if(input.destinationType==="RIMORCHIO_ESSEPI"&&!input.trailerId)throw new ApiError(400,"VALIDATION_ERROR","Rimorchio obbligatorio");if(input.destinationType==="TRASPORTATORE"&&!input.carrierId)throw new ApiError(400,"VALIDATION_ERROR","Trasportatore obbligatorio");}
 private validateTrailer(input:Settings,loadId:string){if(input.destinationType==="RIMORCHIO_ESSEPI"&&input.trailerId&&!this.transports?.isAvailable(input.trailerId,loadId))throw new ApiError(409,"TRAILER_NOT_AVAILABLE","Rimorchio non disponibile");}
}
