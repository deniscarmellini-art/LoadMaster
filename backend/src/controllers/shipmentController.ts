import type { FastifyRequest } from "fastify";
import type { ShipmentInput } from "../repositories/shipmentRepository.js";
import type { ShipmentService } from "../services/shipmentService.js";
interface Id{id:string}
interface DepartureInput{carrierId?:string}
export class ShipmentController{constructor(private readonly service:ShipmentService){}list=async()=>this.service.list();create=async(r:FastifyRequest<{Body:ShipmentInput}>)=>this.service.create(r.body);update=async(r:FastifyRequest<{Params:Id;Body:ShipmentInput}>)=>this.service.update(r.params.id,r.body);link=async(r:FastifyRequest<{Params:Id;Body:{loadId:string}}>)=>this.service.link(r.params.id,r.body.loadId);depart=async(r:FastifyRequest<{Params:Id;Body:DepartureInput}>)=>this.service.depart(r.params.id,r.body??{});delete=async(r:FastifyRequest<{Params:Id}>)=>this.service.delete(r.params.id);}
