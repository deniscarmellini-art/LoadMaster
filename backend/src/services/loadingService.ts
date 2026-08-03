import type { DestinationType } from "../models/operational.js";
import type { LoadingRepository } from "../repositories/loadingRepository.js";
import { ApiError } from "../utils/apiError.js";
import type { TransportRepository } from "../repositories/transportRepository.js";

type Settings={operatorId:string;destinationType:DestinationType;trailerId?:string;carrierId?:string};
export class LoadingService{
 constructor(private readonly repo:LoadingRepository,private readonly transports?:TransportRepository){}
 list(){return this.repo.list();}
 get(id:string){const value=this.repo.find(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Sessione non trovata");return value;}
 byLoad(loadId:string){const value=this.repo.findByLoad(loadId);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Sessione non trovata");return value;}
 create(loadId:string,input:Settings){this.validateDestination(input);const existing=this.repo.findByLoad(loadId);if(existing)return existing;this.validateTrailer(input,loadId);return this.repo.transaction(()=>this.repo.create(loadId,input));}
 update(id:string,input:Settings){const session=this.get(id);this.validateDestination(input);this.validateTrailer(input,session.loadId);return this.repo.transaction(()=>this.repo.update(id,input));}
 addUnit(id:string,input:{unitType:"PANEL"|"PACKAGE";panelId?:string;packageId?:string;operatorId:string}){const session=this.get(id);if(!["DA_CARICARE","IN_CARICO"].includes(session.stato))throw new ApiError(409,"SESSION_CLOSED","Carico già chiuso");const unitId=input.unitType==="PANEL"?input.panelId:input.packageId;if(!unitId)throw new ApiError(400,"VALIDATION_ERROR","Unità non valida");const info=this.repo.unitInfo(input.unitType,unitId);if(!info||info.loadId!==session.loadId||info.stato!=="DISPONIBILE"||info.packageId)throw new ApiError(409,"UNIT_NOT_AVAILABLE","Unità non disponibile");return this.repo.transaction(()=>this.repo.addUnit(id,input));}
 removeUnit(id:string,unitId:string,input:{operatorId:string}){const session=this.get(id);if(session.stato!=="IN_CARICO")throw new ApiError(409,"SESSION_CLOSED","Carico non modificabile");return this.repo.transaction(()=>this.repo.removeUnit(id,unitId,input.operatorId));}
 complete(id:string){const session=this.get(id);if(session.destinationType!=="RIMORCHIO_ESSEPI"||!session.trailerId)throw new ApiError(409,"INVALID_DESTINATION","Rimorchio obbligatorio");if(!this.repo.isComplete(id,session.loadId))throw new ApiError(409,"LOADING_INCOMPLETE","Carico incompleto");return this.repo.transaction(()=>this.repo.complete(id));}
 reopen(id:string,input:{note?:string}){const session=this.get(id);if(session.stato!=="ATTESA_SPEDIZIONE")throw new ApiError(409,"INVALID_STATUS","Solo un carico in attesa può essere riaperto");return this.repo.transaction(()=>this.repo.reopen(id,input.note));}
 ship(id:string,input:{carrierId:string}){const session=this.get(id);if(!["IN_CARICO","ATTESA_SPEDIZIONE"].includes(session.stato))throw new ApiError(409,"INVALID_STATUS","Carico non spedibile");if(session.stato==="IN_CARICO"&&!this.repo.isComplete(id,session.loadId))throw new ApiError(409,"LOADING_INCOMPLETE","Carico incompleto");return this.repo.transaction(()=>this.repo.ship(id,input.carrierId));}
 private validateDestination(input:Settings){if(input.destinationType==="RIMORCHIO_ESSEPI"&&!input.trailerId)throw new ApiError(400,"VALIDATION_ERROR","Rimorchio obbligatorio");if(input.destinationType==="TRASPORTATORE"&&!input.carrierId)throw new ApiError(400,"VALIDATION_ERROR","Trasportatore obbligatorio");}
 private validateTrailer(input:Settings,loadId:string){if(input.destinationType==="RIMORCHIO_ESSEPI"&&input.trailerId&&!this.transports?.isAvailable(input.trailerId,loadId))throw new ApiError(409,"TRAILER_NOT_AVAILABLE","Rimorchio non disponibile");}
}
