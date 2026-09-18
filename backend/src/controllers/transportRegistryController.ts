import type { FastifyReply,FastifyRequest } from "fastify";
import type { TransportRegistryInput } from "../models/settings.js";
import type { TransportRegistryService } from "../services/transportRegistryService.js";
interface IdParams{id:string}
interface ActiveBody{active:boolean}
export class TransportRegistryController{
 constructor(private readonly service:TransportRegistryService){}
 list=async():Promise<unknown>=>this.service.list();
 create=async(request:FastifyRequest<{Body:TransportRegistryInput}>,reply:FastifyReply):Promise<unknown>=>reply.status(201).send(this.service.create(request.body));
 update=async(request:FastifyRequest<{Params:IdParams;Body:TransportRegistryInput}>):Promise<unknown>=>this.service.update(request.params.id,request.body);
 setActive=async(request:FastifyRequest<{Params:IdParams;Body:ActiveBody}>):Promise<unknown>=>this.service.setActive(request.params.id,request.body.active);
 delete=async(request:FastifyRequest<{Params:IdParams}>):Promise<unknown>=>this.service.delete(request.params.id);
}
