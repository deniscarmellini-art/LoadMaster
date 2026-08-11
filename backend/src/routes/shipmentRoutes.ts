import type { FastifyPluginAsync } from "fastify";
import { ShipmentController } from "../controllers/shipmentController.js";
import type { ShipmentService } from "../services/shipmentService.js";
import { idParamsSchema } from "./routeSchemas.js";
interface Options{service:ShipmentService}
const nullableString={anyOf:[{type:"string"},{type:"null"}]} as const;
const body={type:"object",additionalProperties:false,required:["commessa","cliente"],properties:{loadId:nullableString,commessa:{type:"string",minLength:1},cliente:{type:"string",minLength:1},camion:nullableString,plannedLoadingDate:nullableString,plannedDepartureDate:nullableString,transportType:{anyOf:[{type:"string",enum:["BILICO_ESSEPI","TRASPORTATORE_ESTERNO"]},{type:"null"}]},trailerId:nullableString,carrierId:nullableString,notes:nullableString}} as const;
export const shipmentRoutes:FastifyPluginAsync<Options>=async(app,{service})=>{const c=new ShipmentController(service);app.get("",c.list);app.post("",{schema:{body}},c.create);app.put("/:id",{schema:{params:idParamsSchema,body}},c.update);app.patch("/:id/link",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["loadId"],properties:{loadId:{type:"string",minLength:1}}}}},c.link);app.post("/:id/depart",{schema:{params:idParamsSchema}},c.depart);app.delete("/:id",{schema:{params:idParamsSchema}},c.delete);};
