import type { LoadImport,LoadRecord,PanelRecord } from "../models/operational.js";
import type { LoadRepository } from "../repositories/loadRepository.js";
import { ApiError } from "../utils/apiError.js";
import type { TransportRepository } from "../repositories/transportRepository.js";

const normalizeTruck=(value:string)=>value.trim().toUpperCase().replace(/[\s-]+/g,"");
export class LoadService{
 constructor(private readonly repository:LoadRepository,private readonly transports?:TransportRepository){}
 list():LoadRecord[]{return this.repository.list();}
 get(id:string):LoadRecord{const value=this.repository.find(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Commessa non trovata");return value;}
 panels(id:string):PanelRecord[]{this.get(id);return this.repository.panels(id);}
 import(input:LoadImport):LoadRecord[]{const trucks=new Map<string,string>();for(const panel of input.pannelli){const normalized=normalizeTruck(panel.camion);if(normalized&&!trucks.has(normalized))trucks.set(normalized,panel.camion.trim());}if(!trucks.size)throw new ApiError(400,"VALIDATION_ERROR","La distinta non contiene camion validi");return this.repository.transaction(()=>{for(const truck of trucks.values()){const existing=this.repository.findByOrderTruck(input.commessa,truck);if(existing?.stato==="SPEDITO")throw new ApiError(409,"SHIPPED_LOAD","La commessa e il camion risultano già spediti");if(existing)throw new ApiError(409,"LOAD_ALREADY_EXISTS","Questa commessa e questo camion sono già presenti");}return[...trucks.values()].map(truck=>this.repository.createLoad(input,truck));});}
 updateImport(id:string,input:LoadImport):LoadRecord{const existing=this.get(id);if(existing.stato==="SPEDITO")throw new ApiError(409,"SHIPPED_LOAD","Una commessa spedita non può essere aggiornata");return this.repository.transaction(()=>{const updated=this.repository.updateImport(id,input);if(!updated)throw new ApiError(404,"RESOURCE_NOT_FOUND","Commessa non trovata");return updated;});}
 delete(id:string):void{const existing=this.get(id);if(existing.stato==="SPEDITO")throw new ApiError(409,"RESOURCE_IN_USE","Una commessa spedita non può essere eliminata");this.repository.transaction(()=>{this.transports?.releaseByLoad(id);if(!this.repository.delete(id))throw new ApiError(404,"RESOURCE_NOT_FOUND","Commessa non trovata");});}
}
