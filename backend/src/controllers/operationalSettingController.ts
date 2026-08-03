import type { FastifyReply, FastifyRequest } from "fastify";
import type { OperationalSettingInput } from "../models/settings.js";
import type { OperationalSettingService } from "../services/operationalSettingService.js";
interface KeyParams{key:string} interface ActiveBody{active:boolean}
export class OperationalSettingController{
  constructor(private readonly service:OperationalSettingService){}
  list=async():Promise<unknown>=>this.service.list();
  create=async(request:FastifyRequest<{Body:OperationalSettingInput}>,reply:FastifyReply):Promise<unknown>=>reply.status(201).send(this.service.create(request.body));
  update=async(request:FastifyRequest<{Params:KeyParams;Body:OperationalSettingInput}>):Promise<unknown>=>this.service.update(request.params.key,request.body);
  setActive=async(request:FastifyRequest<{Params:KeyParams;Body:ActiveBody}>):Promise<unknown>=>this.service.setActive(request.params.key,request.body.active);
  delete=async(request:FastifyRequest<{Params:KeyParams}>):Promise<unknown>=>this.service.delete(request.params.key);
}
