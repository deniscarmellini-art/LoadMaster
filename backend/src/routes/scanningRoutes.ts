import type { FastifyPluginAsync } from "fastify";
import { ScanningController } from "../controllers/scanningController.js";
import type { ScanningService } from "../services/scanningService.js";
import { idParamsSchema } from "./routeSchemas.js";
interface Options{service:ScanningService}
const operatorBody={type:"object",additionalProperties:false,required:["operatorId"],properties:{operatorId:{type:"string",minLength:1}}} as const;
export const scanningRoutes:FastifyPluginAsync<Options>=async(app,{service})=>{const c=new ScanningController(service);
 app.get("/warehouse",c.warehouse);app.get("/packages",c.packages);app.get("/packages/:id",{schema:{params:idParamsSchema}},c.getPackage);
 app.post("/packages",{schema:{body:{type:"object",additionalProperties:false,required:["loadId","operatorId"],properties:{loadId:{type:"string",minLength:1},operatorId:{type:"string",minLength:1}}}}},c.createPackage);
 app.patch("/packages/:id/location",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["location"],properties:{location:{type:"string",maxLength:120}}}}},c.updatePackageManualLocation);
 app.patch("/panels/:id/scan",{schema:{params:idParamsSchema,body:operatorBody}},c.scan);app.patch("/panels/:id/close-single",{schema:{params:idParamsSchema,body:operatorBody}},c.closeSingle);app.patch("/panels/:id/location",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["location"],properties:{location:{type:"string",maxLength:120}}}}},c.updateManualLocation);
 app.post("/packages/:id/panels",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["panelId","operatorId"],properties:{panelId:{type:"string",minLength:1},operatorId:{type:"string",minLength:1}}}}},c.addPanel);
 app.delete("/packages/:id/panels/:panelId",{schema:{body:operatorBody}},c.removePanel);
 app.post("/packages/:id/close",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["codicePacco","operatoreId","lunghezzaPacco","larghezzaPacco","altezzaPacco"],properties:{codicePacco:{type:"string",minLength:1},operatoreId:{type:"string",minLength:1},lunghezzaPacco:{type:"number",exclusiveMinimum:0},larghezzaPacco:{type:"number",exclusiveMinimum:0},altezzaPacco:{type:"number",exclusiveMinimum:0}}}}},c.closePackage);
 app.delete("/panels/:id",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,properties:{operatorId:{type:"string"}}}}},c.cancelPanel);app.delete("/packages/:id",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,properties:{operatorId:{type:"string"}}}}},c.cancelPackage);
};
