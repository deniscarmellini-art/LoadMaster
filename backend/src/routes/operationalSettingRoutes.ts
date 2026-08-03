import type { FastifyPluginAsync } from "fastify";
import { OperationalSettingController } from "../controllers/operationalSettingController.js";
import type { OperationalSettingService } from "../services/operationalSettingService.js";
import { activeBodySchema, commonProperties } from "./routeSchemas.js";
interface Options{service:OperationalSettingService}
const keyParamsSchema={type:"object",additionalProperties:false,required:["key"],properties:{key:{type:"string",minLength:1,maxLength:100}}} as const;
const bodySchema={type:"object",additionalProperties:false,required:["key","value","description"],properties:{...commonProperties,key:{type:"string",minLength:1,maxLength:100},value:{type:"string",minLength:1,maxLength:500},description:{type:"string",maxLength:500}}} as const;
export const operationalSettingRoutes:FastifyPluginAsync<Options>=async(app,options)=>{const controller=new OperationalSettingController(options.service);app.get("",controller.list);app.post("",{schema:{body:bodySchema}},controller.create);app.put("/:key",{schema:{params:keyParamsSchema,body:bodySchema}},controller.update);app.patch("/:key",{schema:{params:keyParamsSchema,body:activeBodySchema}},controller.setActive);app.delete("/:key",{schema:{params:keyParamsSchema}},controller.delete);};
