import type { DatabaseSync } from "node:sqlite";
import type { ShipmentDocument, ShipmentDocumentElement, DocumentReference } from "../models/shipmentDocument.js";
import { shipmentHistoryMetrics } from "./shipmentHistoryMetrics.js";
import { ApiError } from "../utils/apiError.js";
type Row=Record<string,unknown>;
export function shipmentDocument(db:DatabaseSync,id:string):ShipmentDocument {
 const s=db.prepare("SELECT s.*,l.commessa,l.cliente,l.camion FROM LoadingSessions s JOIN Loads l ON l.id=s.loadId WHERE s.id=?").get(id) as Row|undefined;
 if(!s)throw new ApiError(404,"SHIPMENT_NOT_FOUND","Spedizione non trovata");
 if(s.stato!=="SPEDITO"||!s.shippedAt)throw new ApiError(409,"SHIPMENT_NOT_SHIPPED","La scheda richiede una spedizione conclusa");
 const shippedAt=String(s.shippedAt),warnings=new Set<string>();
 const operators=new Map((db.prepare("SELECT id,code,name,updatedAt FROM Operators").all() as Row[]).map(r=>[String(r.id),r]));
 const op=(id:unknown):DocumentReference|null=>{if(!id)return null;const o=operators.get(String(id));
  if(!o||String(o.updatedAt)>shippedAt){warnings.add("Nomi operatori non storicizzati: dove non attestabili è riportata la sigla conservata, oppure il riferimento.");return{id:String(id),label:o?String(o.code):null};}
  return{id:String(id),label:`${o.code} - ${o.name}`};};
 const reference=(table:"Carriers"|"Trailers",id:unknown):DocumentReference|null=>{
  if(!id)return null;const r=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(String(id)) as Row|undefined;
  if(!r||String(r.updatedAt)>shippedAt){warnings.add(`${table==="Carriers"?"Nome trasportatore":"Descrizione rimorchio"} alla partenza non certificato: anagrafica modificata o assente.`);return{id:String(id),label:null};}
  return{id:String(id),label:String(r[table==="Carriers"?"name":"description"])};
 };
 // transportDetailLabel is the retained label of the selected carrier in Essepi mode.
 const carrier=s.carrierId&&s.transportMode==="BILICO_ESSEPI"&&typeof s.transportDetailLabel==="string"&&s.transportDetailLabel
  ?{id:String(s.carrierId),label:s.transportDetailLabel}:reference("Carriers",s.carrierId);
 const trailer=(s.transportMode==="BILICO_ESSEPI"||(!s.transportMode&&s.destinationType==="RIMORCHIO_ESSEPI"))&&s.trailerId?{...reference("Trailers",s.trailerId)!,plate:String((db.prepare("SELECT plate FROM Trailers WHERE id=?").get(String(s.trailerId)) as Row|undefined)?.plate??"")}:null;
 if(trailer)warnings.add("Targa da anagrafica con identità protetta; descrizione e nominativi non hanno uno snapshot dedicato alla partenza.");
 const units=db.prepare("SELECT panelId,packageId FROM LoadingUnits WHERE loadingSessionId=? AND active=1").all(id) as Row[];
 const singles=new Set(units.filter(u=>u.panelId).map(u=>String(u.panelId))),packs=new Set(units.filter(u=>u.packageId).map(u=>String(u.packageId)));
 const panels=db.prepare("SELECT p.*,k.codicePacco FROM Panels p LEFT JOIN Packages k ON k.id=p.packageId WHERE p.loadId=? ORDER BY p.numeroPannello,p.id").all(String(s.loadId)) as Row[];
 const snapshot=db.prepare("SELECT manifestJson FROM LoadMaterialAvailabilityShipments WHERE loadId=?").get(String(s.loadId)) as {manifestJson:string}|undefined;
 let frozen:Map<string,Row>|null=null;
 if(snapshot){try{const manifest=JSON.parse(snapshot.manifestJson) as {loadId:string;schema:number;panels:Row[]};if(manifest.schema!==1||manifest.loadId!==s.loadId||!Array.isArray(manifest.panels))throw Error();frozen=new Map(manifest.panels.map(p=>[String(p.id),p]));}catch{throw new ApiError(409,"SHIPMENT_SNAPSHOT_INVALID","Snapshot spedizione non leggibile");}}
 else warnings.add("Caratteristiche degli elementi da distinta operativa protetta: questa spedizione non possiede uno snapshot immutabile del materiale.");
 const shipped=panels.filter(p=>singles.has(String(p.id))||packs.has(String(p.packageId)));
 const present=new Set(shipped.map(p=>String(p.id)));
 if([...singles].some(panelId=>!present.has(panelId))||[...packs].some(packageId=>!shipped.some(p=>p.packageId===packageId))||(frozen&&([...frozen.keys()].some(panelId=>!present.has(panelId))||shipped.some(p=>!frozen!.has(String(p.id))))))
  throw new ApiError(409,"SHIPMENT_MANIFEST_INCOMPLETE","Distinta spedita incoerente: verificare elementi e storico prima dell'esportazione");
 const elements:ShipmentDocumentElement[]=shipped.map(p=>{const material=frozen?.get(String(p.id))??p;
  const scannedAt=typeof p.scannedAt==="string"&&p.scannedAt<=shippedAt?p.scannedAt:null;
  if(!scannedAt)warnings.add("Alcune date o attribuzioni delle scansioni non sono disponibili in forma storica attendibile.");
  return{id:String(p.id),unitType:packs.has(String(p.packageId))?"Pacco":"Singolo",packageCode:packs.has(String(p.packageId))?String(p.codicePacco):null,
   number:String(material.numeroPannello),masterPanel:String(material.numeroMasterPanel),thickness:Number(material.spessore),length:Number(material.lunghezza),width:Number(material.altezza),weight:Number(material.peso),volume:Number(material.volume),scanOperator:scannedAt?op(p.scannedByOperatorId):null,scannedAt,state:"SPEDITO"};});
 if(elements.some(e=>[e.thickness,e.length,e.width,e.weight,e.volume].some(n=>!Number.isFinite(n))))throw new ApiError(409,"SHIPMENT_VALUES_INVALID","Valori degli elementi non validi");
 const rawEvents=(db.prepare("SELECT type,timestamp,operatorId,note FROM OperationalEvents WHERE loadingSessionId=? AND timestamp<=? ORDER BY timestamp,id").all(id,shippedAt) as Row[]);
 const eventOp=(type:string,last=false)=>{const list=rawEvents.filter(e=>e.type===type);return op((last?list.at(-1):list[0])?.operatorId);};
 const metrics=shipmentHistoryMetrics(db,String(s.loadId),shippedAt);
 const events=rawEvents.map(e=>({type:String(e.type),timestamp:String(e.timestamp),operator:op(e.operatorId),note:typeof e.note==="string"?e.note:null}));
 return{schemaVersion:1,kind:"SHIPMENT_SHEET",shipmentId:id,loadId:String(s.loadId),order:String(s.commessa),customer:String(s.cliente),truck:String(s.camion),shippedAt,firstPlannedDate:metrics.originalPlannedDepartureDate,transportMode:typeof s.transportMode==="string"?s.transportMode:null,transportDetail:typeof s.transportDetailLabel==="string"?s.transportDetailLabel:null,carrier,trailer,
  operators:{start:eventOp("LOADING_STARTED"),close:eventOp("LOADING_COMPLETED",true),departure:eventOp("PARTENZA_CONFERMATA")},
  totals:{expected:frozen?.size??panels.length,shipped:elements.length,packages:new Set(elements.filter(e=>e.packageCode).map(e=>e.packageCode)).size,weight:elements.reduce((a,e)=>a+e.weight,0),volume:elements.reduce((a,e)=>a+e.volume,0),warehouseDays:metrics.warehouseDays},elements,warnings:[...warnings],events};
}
