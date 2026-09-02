import type { DatabaseSync } from "node:sqlite";
import type { LoadImport,LoadRecord,LoadStatus,PanelImport,PanelRecord,PanelStatus } from "../models/operational.js";
import { requiredNumber,requiredString } from "./repositoryUtils.js";

const nullableString=(row:Record<string,unknown>,key:string)=>typeof row[key]==="string"?row[key] as string:null;
const panelFromRow=(value:unknown):PanelRecord=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),loadId:requiredString(row,"loadId"),numeroPannello:requiredString(row,"numeroPannello"),numeroCliente:requiredString(row,"numeroCliente"),numeroMasterPanel:requiredString(row,"numeroMasterPanel"),camion:requiredString(row,"camion"),lato1:requiredString(row,"lato1"),lato2:requiredString(row,"lato2"),tipoPannello:requiredString(row,"tipoPannello"),quantita:requiredNumber(row,"quantita"),spessore:requiredNumber(row,"spessore"),lunghezza:requiredNumber(row,"lunghezza"),altezza:requiredNumber(row,"altezza"),superficie:requiredNumber(row,"superficie"),volume:requiredNumber(row,"volume"),peso:requiredNumber(row,"peso"),stato:requiredString(row,"stato") as PanelStatus,packageId:nullableString(row,"packageId"),manualLocation:nullableString(row,"manualLocation"),scannedAt:nullableString(row,"scannedAt"),scannedByOperatorId:nullableString(row,"scannedByOperatorId"),createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
const loadBase=(value:unknown):Omit<LoadRecord,"pannelli">=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),commessa:requiredString(row,"commessa"),cliente:requiredString(row,"cliente"),numeroCliente:requiredString(row,"numeroCliente"),riferimentoOrdine:requiredString(row,"riferimentoOrdine"),camion:requiredString(row,"camion"),stato:requiredString(row,"stato") as LoadStatus,createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
const normalizedTruck=(value:string)=>value.trim().toUpperCase().replace(/[\s-]+/g,"");
const normalizedOrder=(value:string)=>value.trim().toUpperCase();
interface RelatedShipmentPlan{id:string;loadId:string|null;manualCommessa:string|null;manualCarico:string|null;actualDepartureDate:string|null}
interface RelatedTransportAssignment{id:string;loadId:string|null;loadingSessionId:string|null;source:string;manualCommessa:string|null;manualCarico:string|null;stato:string;departedAt:string|null;availableFrom:string|null}
export interface OrderDeletionAssessment{loads:LoadRecord[];shipmentPlanIds:string[];preventiveTransportAssignmentIds:string[];blockingReason:string|null}
export class LoadRepository{
 constructor(private readonly database:DatabaseSync){}
 list():LoadRecord[]{return this.database.prepare("SELECT * FROM Loads ORDER BY commessa,camion").all().map(row=>this.withPanels(loadBase(row)));}
 find(id:string):LoadRecord|null{const row=this.database.prepare("SELECT * FROM Loads WHERE id=?").get(id);return row?this.withPanels(loadBase(row)):null;}
 findByOrderTruck(commessa:string,camion:string):LoadRecord|null{const row=this.database.prepare("SELECT * FROM Loads WHERE UPPER(TRIM(commessa))=UPPER(TRIM(?)) AND UPPER(REPLACE(REPLACE(TRIM(camion),' ',''),'-',''))=UPPER(REPLACE(REPLACE(TRIM(?),' ',''),'-','')) ORDER BY CASE WHEN stato='SPEDITO' THEN 0 ELSE 1 END LIMIT 1").get(commessa,camion);return row?this.withPanels(loadBase(row)):null;}
 findByOrder(commessa:string):LoadRecord[]{return this.database.prepare("SELECT * FROM Loads WHERE UPPER(TRIM(commessa))=UPPER(TRIM(?)) ORDER BY camion").all(commessa).map(row=>this.withPanels(loadBase(row)));}
 assessOrderDeletion(commessa:string):OrderDeletionAssessment{
  return this.assessLoadsDeletion(this.findByOrder(commessa),commessa);
 }
 assessLoadDeletion(id:string):OrderDeletionAssessment{const load=this.find(id);return this.assessLoadsDeletion(load?[load]:[],load?.commessa??"");}
 private assessLoadsDeletion(loads:LoadRecord[],commessa:string):OrderDeletionAssessment{
  if(!loads.length)return{loads,shipmentPlanIds:[],preventiveTransportAssignmentIds:[],blockingReason:null};
  const loadIds=new Set(loads.map(load=>load.id)),trucks=new Set(loads.map(load=>normalizedTruck(load.camion))),ids=loads.map(load=>load.id),placeholders=loads.map(()=>"?").join(",");
  const has=(sql:string):boolean=>Boolean(this.database.prepare(sql).get(...ids));
  let blockingReason:string|null=null;
  if(loads.some(load=>load.stato!=="DA_COMPLETARE"))blockingReason="La commessa contiene carichi già iniziati, completati o spediti.";
  else if(loads.some(load=>load.pannelli.some(panel=>panel.stato!=="MANCANTE"||panel.scannedAt!==null||panel.scannedByOperatorId!==null||panel.packageId!==null)))blockingReason="La commessa contiene pannelli già scansionati o preparati.";
  const packages=this.database.prepare(`SELECT id,codicePacco,stato,numeroPannelli FROM Packages WHERE loadId IN (${placeholders})`).all(...ids) as Array<{id:string;codicePacco:string;stato:string;numeroPannelli:number}>;
  const emptyDraftPackageIds=new Set(packages.filter(pack=>pack.stato==="APERTO"&&pack.numeroPannelli===0&&pack.codicePacco.startsWith("DRAFT-")).map(pack=>pack.id));
  if(!blockingReason&&packages.some(pack=>!emptyDraftPackageIds.has(pack.id)))blockingReason="La commessa contiene uno o più pacchi con pannelli o già chiusi.";
  if(!blockingReason&&emptyDraftPackageIds.size){
   const packageIds=[...emptyDraftPackageIds],packagePlaceholders=packageIds.map(()=>"?").join(",");
   if(this.database.prepare(`SELECT 1 FROM LoadingUnits WHERE packageId IN (${packagePlaceholders}) LIMIT 1`).get(...packageIds))blockingReason="La commessa contiene un pacco già utilizzato in una sessione di carico.";
  }
  if(!blockingReason&&has(`SELECT 1 FROM LoadingSessions WHERE loadId IN (${placeholders}) LIMIT 1`))blockingReason="La commessa contiene una sessione di carico.";
  if(!blockingReason&&has(`SELECT 1 FROM LoadingUnits u JOIN LoadingSessions s ON s.id=u.loadingSessionId WHERE s.loadId IN (${placeholders}) LIMIT 1`))blockingReason="La commessa contiene unità di carico operative o storiche.";
  if(!blockingReason){
   const events=this.database.prepare(`SELECT type,packageId FROM OperationalEvents WHERE loadId IN (${placeholders})`).all(...ids) as Array<{type:string;packageId:string|null}>;
   if(events.some(event=>event.type!=="PACKAGE_OPENED"||event.packageId===null||!emptyDraftPackageIds.has(event.packageId)))blockingReason="La commessa contiene eventi operativi o storici.";
  }
  const plans=(this.database.prepare("SELECT id,loadId,manualCommessa,manualCarico,actualDepartureDate FROM ShipmentPlans").all() as unknown as RelatedShipmentPlan[]).filter(plan=>(plan.loadId!==null&&loadIds.has(plan.loadId))||(plan.loadId===null&&plan.manualCommessa!==null&&normalizedOrder(plan.manualCommessa)===normalizedOrder(commessa)&&trucks.has(normalizedTruck(plan.manualCarico??""))));
  if(!blockingReason&&plans.some(plan=>plan.actualDepartureDate!==null))blockingReason="La commessa contiene una spedizione partita o storicizzata.";
  const assignments=(this.database.prepare("SELECT id,loadId,loadingSessionId,source,manualCommessa,manualCarico,stato,departedAt,availableFrom FROM TransportAssignments").all() as unknown as RelatedTransportAssignment[]).filter(assignment=>(assignment.loadId!==null&&loadIds.has(assignment.loadId))||(assignment.source==="MANUAL"&&assignment.manualCommessa!==null&&normalizedOrder(assignment.manualCommessa)===normalizedOrder(commessa)&&trucks.has(normalizedTruck(assignment.manualCarico??""))));
  const isOperational=(assignment:RelatedTransportAssignment):boolean=>assignment.source!=="MANUAL"||assignment.loadId!==null||assignment.loadingSessionId!==null||assignment.departedAt!==null||assignment.availableFrom!==null||assignment.stato==="CARICATO"||assignment.stato==="IN_VIAGGIO";
  if(!blockingReason&&assignments.some(isOperational))blockingReason="La commessa contiene un'assegnazione rimorchio già utilizzata operativamente.";
  return{loads,shipmentPlanIds:plans.map(plan=>plan.id),preventiveTransportAssignmentIds:assignments.filter(assignment=>!isOperational(assignment)).map(assignment=>assignment.id),blockingReason};
 }
 deleteOrderRelations(assessment:OrderDeletionAssessment):void{const remove=(table:string,ids:string[]):void=>{if(ids.length)this.database.prepare(`DELETE FROM ${table} WHERE id IN (${ids.map(()=>"?").join(",")})`).run(...ids);};remove("TransportAssignments",assessment.preventiveTransportAssignmentIds);remove("ShipmentPlans",assessment.shipmentPlanIds);remove("Loads",assessment.loads.map(load=>load.id));}
 panels(id:string):PanelRecord[]{return this.database.prepare("SELECT * FROM Panels WHERE loadId=? ORDER BY numeroPannello").all(id).map(panelFromRow);}
 transaction<T>(operation:()=>T):T{this.database.exec("BEGIN IMMEDIATE");try{const result=operation();this.database.exec("COMMIT");return result;}catch(error:unknown){this.database.exec("ROLLBACK");throw error;}}
 createLoad(input:LoadImport,camion:string):LoadRecord{const id=crypto.randomUUID();const now=new Date().toISOString();this.database.prepare("INSERT INTO Loads (id,commessa,cliente,numeroCliente,riferimentoOrdine,camion,stato,createdAt,updatedAt) VALUES (?,?,?,?,?,?,'DA_COMPLETARE',?,?)").run(id,input.commessa.trim(),input.cliente,input.numeroCliente,input.riferimentoOrdine,camion.trim(),now,now);for(const panel of input.pannelli.filter(item=>normalizedTruck(item.camion)===normalizedTruck(camion)))this.insertPanel(id,panel,now);return this.find(id)!;}
 updateImport(id:string,input:LoadImport):LoadRecord|null{const existing=this.find(id);if(!existing)return null;const now=new Date().toISOString();this.database.prepare("UPDATE Loads SET cliente=?,numeroCliente=?,riferimentoOrdine=?,updatedAt=? WHERE id=?").run(input.cliente,input.numeroCliente,input.riferimentoOrdine,now,id);const incoming=new Map(input.pannelli.filter(item=>normalizedTruck(item.camion)===normalizedTruck(existing.camion)).map(item=>[item.numeroPannello.trim(),item]));for(const panel of existing.pannelli){const next=incoming.get(panel.numeroPannello.trim());if(next){this.database.prepare("UPDATE Panels SET numeroCliente=?,numeroMasterPanel=?,camion=?,lato1=?,lato2=?,tipoPannello=?,quantita=?,spessore=?,lunghezza=?,altezza=?,superficie=?,volume=?,peso=?,updatedAt=? WHERE id=?").run(next.numeroCliente,next.numeroMasterPanel,next.camion.trim(),next.lato1,next.lato2,next.tipoPannello,next.quantita,next.spessore,next.lunghezza,next.altezza,next.superficie,next.volume,next.peso,now,panel.id);incoming.delete(panel.numeroPannello.trim());}else if(input.removeMissing)this.database.prepare("DELETE FROM Panels WHERE id=?").run(panel.id);}
 for(const panel of incoming.values())this.insertPanel(id,panel,now);return this.find(id);}
 delete(id:string):boolean{return this.database.prepare("DELETE FROM Loads WHERE id=?").run(id).changes>0;}
 private withPanels(load:Omit<LoadRecord,"pannelli">):LoadRecord{return{...load,pannelli:this.panels(load.id)};}
 private insertPanel(loadId:string,panel:PanelImport,now:string):void{this.database.prepare("INSERT OR IGNORE INTO Panels (id,loadId,numeroPannello,numeroCliente,numeroMasterPanel,camion,lato1,lato2,tipoPannello,quantita,spessore,lunghezza,altezza,superficie,volume,peso,stato,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'MANCANTE',?,?)").run(crypto.randomUUID(),loadId,panel.numeroPannello.trim(),panel.numeroCliente,panel.numeroMasterPanel,panel.camion.trim(),panel.lato1,panel.lato2,panel.tipoPannello,panel.quantita,panel.spessore,panel.lunghezza,panel.altezza,panel.superficie,panel.volume,panel.peso,now,now);}
}
