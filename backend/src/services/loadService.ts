import type { LoadImport,LoadRecord,PanelRecord } from "../models/operational.js";
import type { LoadRepository } from "../repositories/loadRepository.js";
import { ApiError } from "../utils/apiError.js";

const normalizeTruck=(value:string)=>value.trim().toUpperCase().replace(/[\s-]+/g,"");
export class LoadService{
 constructor(private readonly repository:LoadRepository){}
 list():LoadRecord[]{return this.repository.list();}
 get(id:string):LoadRecord{const value=this.repository.find(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Commessa non trovata");return value;}
 panels(id:string):PanelRecord[]{this.get(id);return this.repository.panels(id);}
 import(input:LoadImport):LoadRecord[]{const trucks=new Map<string,string>();for(const panel of input.pannelli){const normalized=normalizeTruck(panel.camion);if(normalized&&!trucks.has(normalized))trucks.set(normalized,panel.camion.trim());}if(!trucks.size)throw new ApiError(400,"VALIDATION_ERROR","La distinta non contiene camion validi");return this.repository.transaction(()=>{for(const truck of trucks.values()){const existing=this.repository.findByOrderTruck(input.commessa,truck);if(existing?.stato==="SPEDITO")throw new ApiError(409,"SHIPPED_LOAD","La commessa e il camion risultano già spediti");if(existing)throw new ApiError(409,"LOAD_ALREADY_EXISTS","Questa commessa e questo camion sono già presenti");}const loads=[...trucks.values()].map(truck=>this.repository.createLoad(input,truck));this.repository.reconcileShipments(input.commessa);return loads;});}
 updateImport(id:string,input:LoadImport):LoadRecord{
 return this.repository.transaction(()=>{
 const existing=this.repository.findByOrder(input.commessa),load=existing.find(item=>item.id===id);
 if(!load)throw new ApiError(404,"RESOURCE_NOT_FOUND","Carico non trovato nella commessa");
 if(input.pannelli.some(p=>normalizeTruck(p.camion)!==normalizeTruck(load.camion)))throw new ApiError(400,"VALIDATION_ERROR","Usare l'aggiornamento commessa per riassegnare elementi tra camion");
 const panels=existing.filter(item=>item.id!==id).flatMap(item=>item.pannelli);
 return this.repository.updateOrderManifest({...input,pannelli:[...panels,...input.pannelli]}).find(item=>item.id===id)!;
 });
 }

 updateOrderImport(commessa:string,input:LoadImport):LoadRecord[]{
 if(commessa.trim().toUpperCase()!==input.commessa.trim().toUpperCase())throw new ApiError(400,"VALIDATION_ERROR","La commessa della richiesta non coincide con la distinta");
 return this.repository.transaction(()=>this.repository.updateOrderManifest(input));
 }

 delete(id:string,confirmPlanning:boolean):void{this.repository.transaction(()=>{const existing=this.get(id);const assessment=this.repository.assessLoadDeletion(existing.id);if(assessment.blockingReason)throw new ApiError(409,"RESOURCE_IN_USE",`Il carico ${existing.camion} della commessa ${existing.commessa} non può essere eliminato. ${assessment.blockingReason}`);if(assessment.shipmentPlanIds.length&&!confirmPlanning)throw new ApiError(409,"PREVENTIVE_PLAN_CONFIRMATION_REQUIRED",`Il carico ${existing.camion} della commessa ${existing.commessa} ha una pianificazione spedizione collegata. Eliminando il carico verrà eliminata anche la pianificazione. Vuoi continuare?`);this.repository.deleteOrderRelations(assessment);});}
 deleteOrder(commessa:string,confirmPlanning:boolean):void{this.repository.transaction(()=>{const assessment=this.repository.assessOrderDeletion(commessa);if(!assessment.loads.length)throw new ApiError(404,"RESOURCE_NOT_FOUND","Commessa non trovata");if(assessment.blockingReason)throw new ApiError(409,"RESOURCE_IN_USE",assessment.blockingReason);if(assessment.shipmentPlanIds.length&&!confirmPlanning)throw new ApiError(409,"PREVENTIVE_PLAN_CONFIRMATION_REQUIRED","La commessa ha una pianificazione spedizione collegata. Eliminando la commessa verrà eliminata anche la pianificazione. Vuoi continuare?");this.repository.deleteOrderRelations(assessment);});}
}
