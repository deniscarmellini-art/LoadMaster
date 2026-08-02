import type { FastifyReply, FastifyRequest } from "fastify";
import type { TrailerInput } from "../models/settings.js";
import type { TrailerService } from "../services/trailerService.js";
interface IdParams{id:string}
interface ActiveBody{active:boolean}
export class TrailerController{
 constructor(private readonly service:TrailerService){}
 list=async():Promise<unknown>=>this.service.list();
 create=async(request:FastifyRequest<{Body:TrailerInput}>,reply:FastifyReply):Promise<unknown>=>reply.status(201).send(this.service.create(request.body));
 update=async(request:FastifyRequest<{Params:IdParams;Body:TrailerInput}>):Promise<unknown>=>this.service.update(request.params.id,request.body);
 setActive=async(request:FastifyRequest<{Params:IdParams;Body:ActiveBody}>):Promise<unknown>=>this.service.setActive(request.params.id,request.body.active);
 delete=async(request:FastifyRequest<{Params:IdParams}>):Promise<unknown>=>this.service.delete(request.params.id);
}
