import type { FastifyPluginAsync } from "fastify";
import { CarrierController } from "../controllers/carrierController.js";
import type { CarrierService } from "../services/carrierService.js";
import { commonProperties,idParamsSchema } from "./routeSchemas.js";
interface Options{service:CarrierService}
const bodySchema={type:"object",additionalProperties:false,required:["name"],properties:{...commonProperties,name:{type:"string",minLength:1,maxLength:200}}} as const;
export const carrierRoutes:FastifyPluginAsync<Options>=async(app,options)=>{const controller=new CarrierController(options.service);app.get("",controller.list);app.post("",{schema:{body:bodySchema}},controller.create);app.put("/:id",{schema:{params:idParamsSchema,body:bodySchema}},controller.update);app.delete("/:id",{schema:{params:idParamsSchema}},controller.delete);};
