import type { FastifyPluginAsync } from "fastify";
import { OperatorController } from "../controllers/operatorController.js";
import type { OperatorService } from "../services/operatorService.js";
import { activeBodySchema,commonProperties,idParamsSchema } from "./routeSchemas.js";
interface Options{service:OperatorService}
const bodySchema={type:"object",additionalProperties:false,required:["code","name"],properties:{...commonProperties,code:{type:"string",maxLength:20},name:{type:"string",minLength:1,maxLength:200}}} as const;
export const operatorRoutes:FastifyPluginAsync<Options>=async(app,options)=>{const controller=new OperatorController(options.service);app.get("",controller.list);app.post("",{schema:{body:bodySchema}},controller.create);app.put("/:id",{schema:{params:idParamsSchema,body:bodySchema}},controller.update);app.patch("/:id",{schema:{params:idParamsSchema,body:activeBodySchema}},controller.setActive);app.delete("/:id",{schema:{params:idParamsSchema}},controller.delete);};
