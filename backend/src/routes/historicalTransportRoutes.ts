import type { FastifyPluginAsync } from "fastify";
import { HistoricalTransportService,type HistoricalTransportInput } from "../services/historicalTransportService.js";
import type { DatabaseSync } from "node:sqlite";
import { idParamsSchema } from "./routeSchemas.js";

export const historicalTransportRoutes:FastifyPluginAsync<{database:DatabaseSync}>=async(app,{database})=>{
  const service=new HistoricalTransportService(database);
  app.get<{Params:{id:string}}>("/loading-sessions/:id/historical-transport",{schema:{params:idParamsSchema}},async r=>service.status(r.params.id));
  app.post<{Params:{id:string};Body:HistoricalTransportInput}>("/loading-sessions/:id/historical-transport",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["operatorId","transportMode","confirmed","revision"],properties:{operatorId:{type:"string",minLength:1},transportMode:{enum:["BILICO_ESSEPI","RITIRA_CLIENTE","TERZI_PER_ESSEPI"]},carrierId:{type:"string",minLength:1},transportDetailId:{type:"string",minLength:1},confirmed:{const:true,type:"boolean"},revision:{type:"string",pattern:"^[a-f0-9]{64}$"}}}}},async r=>service.complete(r.params.id,r.body));
};
