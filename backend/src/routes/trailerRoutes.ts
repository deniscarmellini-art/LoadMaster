import type { FastifyPluginAsync } from "fastify";
import { TrailerController } from "../controllers/trailerController.js";
import type { TrailerService } from "../services/trailerService.js";
import { activeBodySchema,commonProperties,idParamsSchema } from "./routeSchemas.js";
interface Options{service:TrailerService}
const bodySchema={type:"object",additionalProperties:false,required:["plate","description"],properties:{...commonProperties,plate:{type:"string",minLength:1,maxLength:50},description:{type:"string",maxLength:300},nextInspectionDate:{anyOf:[{type:"string"},{type:"null"}]}}} as const;
export const trailerRoutes:FastifyPluginAsync<Options>=async(app,options)=>{const controller=new TrailerController(options.service);app.get("",controller.list);app.post("",{schema:{body:bodySchema}},controller.create);app.put("/:id",{schema:{params:idParamsSchema,body:bodySchema}},controller.update);app.patch("/:id",{schema:{params:idParamsSchema,body:activeBodySchema}},controller.setActive);app.delete("/:id",{schema:{params:idParamsSchema}},controller.delete);};
