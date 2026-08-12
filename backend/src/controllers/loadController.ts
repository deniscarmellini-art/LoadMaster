import type { FastifyReply,FastifyRequest } from "fastify";
import type { LoadImport } from "../models/operational.js";
import type { LoadService } from "../services/loadService.js";
interface IdParams{id:string}
interface OrderParams{orderNumber:string}
interface DeleteOrderQuery{confirmPlanning?:boolean}
export class LoadController{
 constructor(private readonly service:LoadService){}
 list=async():Promise<unknown>=>this.service.list();
 get=async(request:FastifyRequest<{Params:IdParams}>):Promise<unknown>=>this.service.get(request.params.id);
 panels=async(request:FastifyRequest<{Params:IdParams}>):Promise<unknown>=>this.service.panels(request.params.id);
 import=async(request:FastifyRequest<{Body:LoadImport}>,reply:FastifyReply):Promise<unknown>=>reply.status(201).send(this.service.import(request.body));
 updateImport=async(request:FastifyRequest<{Params:IdParams;Body:LoadImport}>):Promise<unknown>=>this.service.updateImport(request.params.id,request.body);
 delete=async(request:FastifyRequest<{Params:IdParams}>,reply:FastifyReply):Promise<void>=>{this.service.delete(request.params.id);await reply.status(204).send();};
 deleteOrder=async(request:FastifyRequest<{Params:OrderParams;Querystring:DeleteOrderQuery}>,reply:FastifyReply):Promise<void>=>{this.service.deleteOrder(request.params.orderNumber,request.query.confirmPlanning===true);await reply.status(204).send();};
 updateOrderImport=async(request:FastifyRequest<{Params:OrderParams;Body:LoadImport}>):Promise<unknown>=>this.service.updateOrderImport(request.params.orderNumber,request.body);
}
