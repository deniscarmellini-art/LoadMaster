import type { FastifyReply, FastifyRequest } from "fastify";
import type { CarrierInput } from "../models/settings.js";
import type { CarrierService } from "../services/carrierService.js";
interface IdParams{id:string}
interface ActiveBody{active:boolean}
export class CarrierController{
 constructor(private readonly service:CarrierService){}
 list=async():Promise<unknown>=>this.service.list();
 create=async(request:FastifyRequest<{Body:CarrierInput}>,reply:FastifyReply):Promise<unknown>=>reply.status(201).send(this.service.create(request.body));
 update=async(request:FastifyRequest<{Params:IdParams;Body:CarrierInput}>):Promise<unknown>=>this.service.update(request.params.id,request.body);
 setActive=async(request:FastifyRequest<{Params:IdParams;Body:ActiveBody}>):Promise<unknown>=>this.service.setActive(request.params.id,request.body.active);
 delete=async(request:FastifyRequest<{Params:IdParams}>):Promise<unknown>=>this.service.delete(request.params.id);
}
