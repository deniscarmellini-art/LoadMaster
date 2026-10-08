import { trackMaterialAvailability, materialAvailabilityDetails } from "./materialAvailability.js";
import type { DatabaseSync } from "node:sqlite";
import type { LoadImport,LoadRecord,LoadStatus,PanelImport,PanelRecord,PanelStatus } from "../models/operational.js";
import { requiredNumber,requiredString } from "./repositoryUtils.js";
import { reconcileAllOperationalLoadStatuses,reconcileOperationalLoadStatus } from "./operationalLoadStatus.js";
import { reconcileManualShipments } from "./shipmentReconciliation.js";
import { ApiError } from "../utils/apiError.js";

const nullableString=(row:Record<string,unknown>,key:string)=>typeof row[key]==="string"?row[key] as string:null;
const panelFromRow=(value:unknown):PanelRecord=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),loadId:requiredString(row,"loadId"),numeroPannello:requiredString(row,"numeroPannello"),numeroCliente:requiredString(row,"numeroCliente"),numeroMasterPanel:requiredString(row,"numeroMasterPanel"),camion:requiredString(row,"camion"),lato1:requiredString(row,"lato1"),lato2:requiredString(row,"lato2"),tipoPannello:requiredString(row,"tipoPannello"),quantita:requiredNumber(row,"quantita"),spessore:requiredNumber(row,"spessore"),lunghezza:requiredNumber(row,"lunghezza"),altezza:requiredNumber(row,"altezza"),superficie:requiredNumber(row,"superficie"),volume:requiredNumber(row,"volume"),peso:requiredNumber(row,"peso"),stato:requiredString(row,"stato") as PanelStatus,packageId:nullableString(row,"packageId"),manualLocation:nullableString(row,"manualLocation"),scannedAt:nullableString(row,"scannedAt"),scannedByOperatorId:nullableString(row,"scannedByOperatorId"),createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
const loadBase=(value:unknown):Omit<LoadRecord,"pannelli">=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),commessa:requiredString(row,"commessa"),cliente:requiredString(row,"cliente"),numeroCliente:requiredString(row,"numeroCliente"),riferimentoOrdine:requiredString(row,"riferimentoOrdine"),camion:requiredString(row,"camion"),stato:requiredString(row,"stato") as LoadStatus,createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
const normalizedTruck=(value:string)=>value.trim().toUpperCase().replace(/[\s-]+/g,"");
const normalizedOrder=(value:string)=>value.trim().toUpperCase();
interface RelatedShipmentPlan{id:string;loadId:string|null;manualCommessa:string|null;manualCarico:string|null;actualDepartureDate:string|null}
interface RelatedTransportAssignment{id:string;loadId:string|null;loadingSessionId:string|null;source:string;manualCommessa:string|null;manualCarico:string|null;stato:string;departedAt:string|null;availableFrom:string|null}
export interface OrderDeletionAssessment{loads:LoadRecord[];shipmentPlanIds:string[];reversibleLoadingSessionIds:string[];preventiveTransportAssignmentIds:string[];blockingReason:string|null}
export class LoadRepository{
 constructor(private readonly database:DatabaseSync){}
 reconcileShipments(commessa:string):void{reconcileManualShipments(this.database,commessa);}
 // Reconcile identity across the order before applying truck assignments.
 updateOrderManifest(input:LoadImport):LoadRecord[]{
  const loads=this.findByOrder(input.commessa), incoming=new Map<string,PanelImport>();
  const existing=new Map<string,{panel:PanelRecord;load:LoadRecord}>();
  const ghosts:PanelRecord[]=[];
  const fields=["numeroCliente","numeroMasterPanel","lato1","lato2","tipoPannello","quantita","spessore","lunghezza","altezza","superficie","volume","peso"] as const;
  const pristine=(p:PanelRecord)=>p.stato==="MANCANTE"&&!p.packageId&&!p.scannedAt&&!p.scannedByOperatorId&&!p.manualLocation&&!this.database.prepare("SELECT 1 FROM OperationalEvents WHERE panelId=? UNION ALL SELECT 1 FROM LoadingUnits WHERE panelId=?").get(p.id,p.id);
  const conflict=(message:string):never=>{throw new ApiError(409,"MANIFEST_CONFLICT",message);};
  for(const next of input.pannelli){const key=next.numeroPannello.trim();if(!key||!normalizedTruck(next.camion))conflict("Identificativo elemento o camion vuoto");if(incoming.has(key))conflict(`Elemento ${key} duplicato nella distinta`);incoming.set(key,next);}
  for(const load of loads)for(const panel of load.pannelli){
   const key=panel.numeroPannello.trim(),previous=existing.get(key);
   if(previous){
    const same=fields.every(field=>previous.panel[field]===panel[field]);
    const original=previous.panel.scannedAt&&!pristine(previous.panel)&&pristine(panel)?previous:panel.scannedAt&&!pristine(panel)&&pristine(previous.panel)?{panel,load}:null;
    const ghost=original?.panel.id===panel.id?previous.panel:panel;
    const ghostLoad=original?.panel.id===panel.id?previous.load:load;
    const next=incoming.get(key);
    if(!same||!original||!next||normalizedTruck(next.camion)!==normalizedTruck(ghostLoad.camion)||ghostLoad.stato==="SPEDITO")conflict(`Identità ambigua: elemento ${key} presente su più camion`);
    ghosts.push(ghost);existing.set(key,original!);
   }else existing.set(key,{panel,load});
  }
  const shipped=(load:LoadRecord)=>load.stato==="SPEDITO"||Boolean(this.database.prepare("SELECT 1 FROM LoadingSessions WHERE loadId=? AND (stato='SPEDITO' OR shippedAt IS NOT NULL) UNION ALL SELECT 1 FROM ShipmentPlans WHERE loadId=? AND actualDepartureDate IS NOT NULL UNION ALL SELECT 1 FROM OperationalEvents WHERE loadId=? AND type='PARTENZA_CONFERMATA'").get(load.id,load.id,load.id));
  const locked=new Set(loads.filter(shipped).map(load=>load.id));
  // Assess disappearing trucks against the original operational data.
  if(input.removeMissing)for(const load of loads)if(!locked.has(load.id)&&!input.pannelli.some(p=>normalizedTruck(p.camion)===normalizedTruck(load.camion))&&!load.pannelli.some(p=>incoming.has(p.numeroPannello.trim()))){
   const assessment=this.assessLoadsDeletion([load],input.commessa);
   if(assessment.blockingReason||assessment.shipmentPlanIds.length||assessment.preventiveTransportAssignmentIds.length)throw new ApiError(409,"RESOURCE_IN_USE",`Camion ${load.camion}: ${assessment.blockingReason??"pianificazione collegata"}`);
  }
  const operational=(panel:PanelRecord)=>panel.stato==="CARICATO"||panel.stato==="SPEDITO"||Boolean(this.database.prepare("SELECT 1 FROM LoadingUnits WHERE active=1 AND (panelId=? OR (packageId=? AND packageId IS NOT NULL))").get(panel.id,panel.packageId));
  for(const {panel,load} of existing.values()){
   const next=incoming.get(panel.numeroPannello.trim()),moving=next&&normalizedTruck(next.camion)!==normalizedTruck(load.camion);
   if(locked.has(load.id)||panel.stato==="SPEDITO"){
    // Operational manifests may omit consolidated history. Explicit references
    // must still describe the same shipped element on its original truck.
    if(next&&(moving||fields.some(field=>panel[field]!==next[field])))conflict(`Elemento ${panel.numeroPannello} del camion ${load.camion} spedito: assegnazione o dati incompatibili`);
    continue;
   }
   if((moving||(!next&&input.removeMissing))&&operational(panel))conflict(`Elemento ${panel.numeroPannello} già caricato su ${load.camion}: scaricare esplicitamente prima di modificare la distinta`);
   if((moving||(!next&&input.removeMissing))&&panel.packageId)conflict(`Elemento ${panel.numeroPannello} associato a un pacco: modificare esplicitamente il pacco prima della distinta`);
   if(!next&&input.removeMissing&&this.database.prepare("SELECT 1 FROM LoadingUnits WHERE panelId=?").get(panel.id))conflict(`Elemento ${panel.numeroPannello} con storico di carico: rimozione vietata`);
  }
  const byTruck=new Map(loads.map(load=>[normalizedTruck(load.camion),load]));
  for(const next of incoming.values())if(!byTruck.has(normalizedTruck(next.camion))){const created=this.createLoad({...input,pannelli:[]},next.camion);byTruck.set(normalizedTruck(next.camion),created);}
  const now=new Date().toISOString(),changed=new Set<string>();
  for(const ghost of ghosts){if(locked.has(ghost.loadId))conflict(`Copia elemento ${ghost.numeroPannello} su camion spedito`);this.database.prepare("DELETE FROM Panels WHERE id=?").run(ghost.id);changed.add(ghost.loadId);}
  for(const [key,next] of incoming){
   const found=existing.get(key),target=byTruck.get(normalizedTruck(next.camion))!;
   if(!found){if(locked.has(target.id))conflict(`Camion ${target.camion} spedito: nuovi elementi vietati`);this.insertPanel(target.id,next,now);changed.add(target.id);continue;}
   const {panel,load}=found;
   if(locked.has(load.id)||panel.stato==="SPEDITO"||operational(panel))continue;
   const moving=load.id!==target.id;
   if(moving&&locked.has(target.id))conflict(`Camion ${target.camion} spedito: riassegnazione vietata`);
   if(!moving&&fields.every(field=>panel[field]===next[field]))continue;
   this.database.prepare(`UPDATE Panels SET loadId=?,camion=?,${fields.map(field=>`${field}=?`).join(",")},updatedAt=? WHERE id=?`).run(target.id,target.camion,...fields.map(field=>next[field]),now,panel.id);
   changed.add(load.id);changed.add(target.id);
   if(moving)this.database.prepare("INSERT INTO OperationalEvents(id,loadId,panelId,type,timestamp,note) VALUES(?,?,?,'PANEL_REASSIGNED',?,?)").run(crypto.randomUUID(),target.id,panel.id,now,`Distinta: ${load.camion} (${load.id}) → ${target.camion} (${target.id})`);
  }
  if(input.removeMissing)for(const [key,{panel,load}] of existing)if(!incoming.has(key)&&!locked.has(load.id)&&panel.stato!=="SPEDITO"){this.database.prepare("DELETE FROM Panels WHERE id=?").run(panel.id);changed.add(load.id);}
  for(const load of byTruck.values())if(!locked.has(load.id)){
   if(load.cliente!==input.cliente||load.numeroCliente!==input.numeroCliente||load.riferimentoOrdine!==input.riferimentoOrdine)this.database.prepare("UPDATE Loads SET cliente=?,numeroCliente=?,riferimentoOrdine=?,updatedAt=? WHERE id=?").run(input.cliente,input.numeroCliente,input.riferimentoOrdine,now,load.id);
   if(input.removeMissing&&!this.panels(load.id).length&&!input.pannelli.some(p=>normalizedTruck(p.camion)===normalizedTruck(load.camion))){const assessment=this.assessLoadsDeletion([load],input.commessa);if(assessment.blockingReason||assessment.shipmentPlanIds.length||assessment.preventiveTransportAssignmentIds.length)conflict(`Camion ${load.camion} con relazioni operative: rimozione vietata`);this.deleteOrderRelations(assessment);continue;}
   if(changed.has(load.id))reconcileOperationalLoadStatus(this.database,load.id);
  }
  this.reconcileShipments(input.commessa);
  return this.findByOrder(input.commessa);
 }
 list():LoadRecord[]{reconcileAllOperationalLoadStatuses(this.database);return this.database.prepare("SELECT * FROM Loads ORDER BY commessa,camion").all().map(row=>this.withPanels(loadBase(row)));}
 find(id:string):LoadRecord|null{if(this.database.prepare("SELECT 1 FROM Loads WHERE id=?").get(id))reconcileOperationalLoadStatus(this.database,id);const row=this.database.prepare("SELECT * FROM Loads WHERE id=?").get(id);return row?this.withPanels(loadBase(row)):null;}
 findByOrderTruck(commessa:string,camion:string):LoadRecord|null{const row=this.database.prepare("SELECT * FROM Loads WHERE UPPER(TRIM(commessa))=UPPER(TRIM(?)) AND UPPER(REPLACE(REPLACE(TRIM(camion),' ',''),'-',''))=UPPER(REPLACE(REPLACE(TRIM(?),' ',''),'-','')) ORDER BY CASE WHEN stato='SPEDITO' THEN 0 ELSE 1 END LIMIT 1").get(commessa,camion);return row?this.withPanels(loadBase(row)):null;}
 findByOrder(commessa:string):LoadRecord[]{return this.database.prepare("SELECT * FROM Loads WHERE UPPER(TRIM(commessa))=UPPER(TRIM(?)) ORDER BY camion").all(commessa).map(row=>this.withPanels(loadBase(row)));}
 assessOrderDeletion(commessa:string):OrderDeletionAssessment{
  return this.assessLoadsDeletion(this.findByOrder(commessa),commessa);
 }
 assessLoadDeletion(id:string):OrderDeletionAssessment{const load=this.find(id);return this.assessLoadsDeletion(load?[load]:[],load?.commessa??"");}
 private assessLoadsDeletion(loads:LoadRecord[],commessa:string):OrderDeletionAssessment{
  if(!loads.length)return{loads,shipmentPlanIds:[],reversibleLoadingSessionIds:[],preventiveTransportAssignmentIds:[],blockingReason:null};
  const loadIds=new Set(loads.map(load=>load.id)),trucks=new Set(loads.map(load=>normalizedTruck(load.camion))),ids=loads.map(load=>load.id),placeholders=loads.map(()=>"?").join(",");
  const has=(sql:string):boolean=>Boolean(this.database.prepare(sql).get(...ids));
  const sessions=this.database.prepare(`SELECT id,loadId,stato,shippedAt FROM LoadingSessions WHERE loadId IN (${placeholders})`).all(...ids) as Array<{id:string;loadId:string;stato:string;shippedAt:string|null}>;
  const hasReversibleLoadingHistory=sessions.length>0;
  let blockingReason:string|null=null;
  if(loads.some(load=>load.stato==="SPEDITO"||load.pannelli.some(panel=>panel.stato==="SPEDITO"))||sessions.some(session=>session.stato==="SPEDITO"||session.shippedAt!==null))blockingReason="La commessa contiene una sessione di carico partita o consolidata.";
  else if(has(`SELECT 1 FROM LoadingUnits u JOIN LoadingSessions s ON s.id=u.loadingSessionId WHERE s.loadId IN (${placeholders}) AND u.active=1 LIMIT 1`))blockingReason="La commessa contiene elementi o pacchi attualmente caricati.";
  else if(!hasReversibleLoadingHistory&&loads.some(load=>load.stato!=="DA_COMPLETARE"))blockingReason="La commessa contiene carichi già iniziati, completati o spediti.";
  else if(!hasReversibleLoadingHistory&&loads.some(load=>load.pannelli.some(panel=>panel.stato!=="MANCANTE"||panel.scannedAt!==null||panel.scannedByOperatorId!==null||panel.packageId!==null)))blockingReason="La commessa contiene elementi già scansionati o preparati.";
  const packages=this.database.prepare(`SELECT id,codicePacco,stato,numeroPannelli FROM Packages WHERE loadId IN (${placeholders})`).all(...ids) as Array<{id:string;codicePacco:string;stato:string;numeroPannelli:number}>;
  const emptyDraftPackageIds=new Set(packages.filter(pack=>pack.stato==="APERTO"&&pack.numeroPannelli===0&&pack.codicePacco.startsWith("DRAFT-")).map(pack=>pack.id));
  if(!blockingReason&&packages.some(pack=>pack.stato==="SPEDITO"))blockingReason="La commessa contiene pacchi spediti.";
  if(!blockingReason&&!hasReversibleLoadingHistory&&packages.some(pack=>!emptyDraftPackageIds.has(pack.id)))blockingReason="La commessa contiene uno o più pacchi con elementi o già chiusi.";
  if(!blockingReason&&emptyDraftPackageIds.size){
   const packageIds=[...emptyDraftPackageIds],packagePlaceholders=packageIds.map(()=>"?").join(",");
   if(this.database.prepare(`SELECT 1 FROM LoadingUnits WHERE packageId IN (${packagePlaceholders}) AND active=1 LIMIT 1`).get(...packageIds))blockingReason="La commessa contiene un pacco attualmente caricato.";
  }
  if(!blockingReason){
   const events=this.database.prepare(`SELECT type FROM OperationalEvents WHERE loadId IN (${placeholders})`).all(...ids) as Array<{type:string}>;
   // Audit records describe attempts and reversals; only departure is definitive.
   if(events.some(event=>event.type==="PARTENZA_CONFERMATA"))blockingReason="La commessa contiene eventi operativi o storici consolidati.";
  }
  const plans=(this.database.prepare("SELECT id,loadId,manualCommessa,manualCarico,actualDepartureDate FROM ShipmentPlans").all() as unknown as RelatedShipmentPlan[]).filter(plan=>(plan.loadId!==null&&loadIds.has(plan.loadId))||(plan.loadId===null&&plan.manualCommessa!==null&&normalizedOrder(plan.manualCommessa)===normalizedOrder(commessa)&&trucks.has(normalizedTruck(plan.manualCarico??""))));
  if(!blockingReason&&plans.some(plan=>plan.actualDepartureDate!==null))blockingReason="La commessa contiene una spedizione partita o storicizzata.";
  const assignments=(this.database.prepare("SELECT id,loadId,loadingSessionId,source,manualCommessa,manualCarico,stato,departedAt,availableFrom FROM TransportAssignments").all() as unknown as RelatedTransportAssignment[]).filter(assignment=>(assignment.loadId!==null&&loadIds.has(assignment.loadId))||(assignment.source==="MANUAL"&&assignment.manualCommessa!==null&&normalizedOrder(assignment.manualCommessa)===normalizedOrder(commessa)&&trucks.has(normalizedTruck(assignment.manualCarico??""))));
  const isConsolidated=(assignment:RelatedTransportAssignment):boolean=>assignment.departedAt!==null||assignment.availableFrom!==null||assignment.stato==="IN_VIAGGIO";
  if(!blockingReason&&assignments.some(isConsolidated))blockingReason="La commessa contiene un'assegnazione rimorchio partita o consolidata.";
  return{loads,shipmentPlanIds:plans.map(plan=>plan.id),reversibleLoadingSessionIds:sessions.map(session=>session.id),preventiveTransportAssignmentIds:assignments.filter(assignment=>!isConsolidated(assignment)).map(assignment=>assignment.id),blockingReason};
 }
 deleteOrderRelations(assessment:OrderDeletionAssessment):void{const remove=(table:string,ids:string[]):void=>{if(ids.length)this.database.prepare(`DELETE FROM ${table} WHERE id IN (${ids.map(()=>"?").join(",")})`).run(...ids);};remove("TransportAssignments",assessment.preventiveTransportAssignmentIds);remove("ShipmentPlans",assessment.shipmentPlanIds);remove("LoadingSessions",assessment.reversibleLoadingSessionIds);remove("Loads",assessment.loads.map(load=>load.id));}
 panels(id:string):PanelRecord[]{return this.database.prepare("SELECT * FROM Panels WHERE loadId=? ORDER BY numeroPannello").all(id).map(panelFromRow);}
 transaction<T>(operation:()=>T):T{this.database.exec("BEGIN IMMEDIATE");try{const result=trackMaterialAvailability(this.database,operation);this.database.exec("COMMIT");return result;}catch(error:unknown){this.database.exec("ROLLBACK");throw error;}}
 createLoad(input:LoadImport,camion:string):LoadRecord{const id=crypto.randomUUID();const now=new Date().toISOString();this.database.prepare("INSERT INTO Loads (id,commessa,cliente,numeroCliente,riferimentoOrdine,camion,stato,createdAt,updatedAt) VALUES (?,?,?,?,?,?,'DA_COMPLETARE',?,?)").run(id,input.commessa.trim(),input.cliente,input.numeroCliente,input.riferimentoOrdine,camion.trim(),now,now);for(const panel of input.pannelli.filter(item=>normalizedTruck(item.camion)===normalizedTruck(camion)))this.insertPanel(id,panel,now);return this.find(id)!;}

 delete(id:string):boolean{return this.database.prepare("DELETE FROM Loads WHERE id=?").run(id).changes>0;}
 private withPanels(load:Omit<LoadRecord,"pannelli">):LoadRecord{return{...load,pannelli:this.panels(load.id),materialAvailability:materialAvailabilityDetails(this.database,load.id)};}
 private insertPanel(loadId:string,panel:PanelImport,now:string):void{this.database.prepare("INSERT OR IGNORE INTO Panels (id,loadId,numeroPannello,numeroCliente,numeroMasterPanel,camion,lato1,lato2,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,volume,peso,stato,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'MANCANTE',?,?)").run(crypto.randomUUID(),loadId,panel.numeroPannello.trim(),panel.numeroCliente,panel.numeroMasterPanel,panel.camion.trim(),panel.lato1,panel.lato2,panel.tipoPannello,panel.quantita,panel.spessore,panel.lunghezza,panel.altezza,panel.superficie,panel.volume,panel.peso,now,now);}
}
