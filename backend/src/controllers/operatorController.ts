import type { FastifyReply, FastifyRequest } from "fastify";
import type { OperatorInput } from "../models/settings.js";
import type { OperatorService } from "../services/operatorService.js";

interface IdParams { id:string }
export class OperatorController{
 constructor(private readonly service:OperatorService){}
 list=async():Promise<unknown>=>this.service.list();
 create=async(request:FastifyRequest<{Body:OperatorInput}>,reply:FastifyReply):Promise<unknown>=>reply.status(201).send(this.service.create(request.body));
 update=async(request:FastifyRequest<{Params:IdParams;Body:OperatorInput}>):Promise<unknown>=>this.service.update(request.params.id,request.body);
 delete=async(request:FastifyRequest<{Params:IdParams}>):Promise<unknown>=>this.service.delete(request.params.id);
}
