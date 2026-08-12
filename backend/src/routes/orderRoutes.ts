import type { FastifyPluginAsync } from "fastify";
import { LoadController } from "../controllers/loadController.js";
import type { LoadService } from "../services/loadService.js";
import { importSchema } from "./loadRoutes.js";

interface Options{service:LoadService}
const paramsSchema={type:"object",additionalProperties:false,required:["orderNumber"],properties:{orderNumber:{type:"string",minLength:1,maxLength:100}}} as const;
const querySchema={type:"object",additionalProperties:false,properties:{confirmPlanning:{type:"boolean",default:false}}} as const;
export const orderRoutes:FastifyPluginAsync<Options>=async(app,options)=>{const controller=new LoadController(options.service);app.put("/:orderNumber/import",{schema:{params:paramsSchema,body:importSchema}},controller.updateOrderImport);app.delete("/:orderNumber",{schema:{params:paramsSchema,querystring:querySchema}},controller.deleteOrder);};
