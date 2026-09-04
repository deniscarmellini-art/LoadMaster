import type { FastifyReply,FastifyRequest } from "fastify";
import type { ScanningService } from "../services/scanningService.js";
interface Id{id:string} interface PackagePanel{ id:string;panelId:string }
export class ScanningController{
 constructor(private readonly service:ScanningService){}
 warehouse=async()=>this.service.warehouse(); packages=async()=>this.service.listPackages(); getPackage=async(r:FastifyRequest<{Params:Id}>)=>this.service.getPackage(r.params.id);
 createPackage=async(r:FastifyRequest<{Body:{loadId:string;operatorId:string}}>,reply:FastifyReply)=>reply.status(201).send(this.service.createPackage(r.body));
 scan=async(r:FastifyRequest<{Params:Id;Body:{operatorId:string}}>)=>this.service.scan(r.params.id,r.body);
 closeSingle=async(r:FastifyRequest<{Params:Id;Body:{operatorId:string}}>)=>this.service.closeSingle(r.params.id,r.body);
 updateManualLocation=async(r:FastifyRequest<{Params:Id;Body:{location:string}}>)=>this.service.updateManualLocation(r.params.id,r.body);
 updatePackageManualLocation=async(r:FastifyRequest<{Params:Id;Body:{location:string}}>)=>this.service.updatePackageManualLocation(r.params.id,r.body);
 addPanel=async(r:FastifyRequest<{Params:Id;Body:{panelId:string;operatorId:string}}>)=>this.service.addPanel(r.params.id,r.body);
 removePanel=async(r:FastifyRequest<{Params:PackagePanel;Body:{operatorId:string}}>)=>this.service.removePanel(r.params.id,r.params.panelId,r.body);
 closePackage=async(r:FastifyRequest<{Params:Id;Body:{codicePacco:string;operatoreId:string;lunghezzaPacco:number;larghezzaPacco:number;altezzaPacco:number}}>)=>this.service.closePackage(r.params.id,r.body);
 cancelPanel=async(r:FastifyRequest<{Params:Id;Body:{operatorId?:string}}>)=>this.service.cancelPanel(r.params.id,r.body);
 cancelPackage=async(r:FastifyRequest<{Params:Id;Body:{operatorId?:string}}>)=>{const packageId=r.params.id;r.log.info({packageId},"Richiesta eliminazione pacco");try{const result=this.service.cancelPackage(packageId,r.body);r.log.info({packageId},"Pacco eliminato e assenza verificata");return result;}catch(error:unknown){r.log.warn({err:error,packageId},"Eliminazione pacco rifiutata o non riuscita");throw error;}};
}
