import type { FastifyPluginAsync } from "fastify";
import { TransportRegistryController } from "../controllers/transportRegistryController.js";
import type { TransportRegistryService } from "../services/transportRegistryService.js";
import { activeBodySchema,commonProperties,idParamsSchema } from "./routeSchemas.js";
interface Options{service:TransportRegistryService}
const bodySchema={type:"object",additionalProperties:false,required:["name"],properties:{...commonProperties,name:{type:"string",minLength:1,maxLength:200}}} as const;
export const transportRegistryRoutes:FastifyPluginAsync<Options>=async(app,options)=>{const controller=new TransportRegistryController(options.service);app.get("",controller.list);app.post("",{schema:{body:bodySchema}},controller.create);app.put("/:id",{schema:{params:idParamsSchema,body:bodySchema}},controller.update);app.patch("/:id",{schema:{params:idParamsSchema,body:activeBodySchema}},controller.setActive);app.delete("/:id",{schema:{params:idParamsSchema}},controller.delete);};
