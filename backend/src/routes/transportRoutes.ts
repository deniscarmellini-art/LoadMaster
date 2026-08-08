import type { FastifyPluginAsync } from "fastify";
import { TransportController } from "../controllers/transportController.js";
import type { TransportService } from "../services/transportService.js";
import { idParamsSchema } from "./routeSchemas.js";

interface Options { service: TransportService }
const optionalDate={anyOf:[{type:"string"},{type:"null"}]} as const;
const trailerParamsSchema={type:"object",additionalProperties:false,required:["trailerId"],properties:{trailerId:{type:"string",minLength:1,maxLength:100}}} as const;
const reservationBody={type:"object",additionalProperties:false,required:["commessa","cliente","carico"],properties:{commessa:{type:"string",minLength:1},cliente:{type:"string",minLength:1},carico:{type:"string",minLength:1},plannedDepartureDate:optionalDate}} as const;

export const transportRoutes:FastifyPluginAsync<Options>=async(app,{service})=>{
  const controller=new TransportController(service);
  app.get("/transports",controller.list);
  app.get("/transports/:trailerId",{schema:{params:trailerParamsSchema}},controller.get);
  app.post("/trailers/:id/reservation",{schema:{params:idParamsSchema,body:reservationBody}},controller.reserve);
  app.put("/trailers/:id/reservation",{schema:{params:idParamsSchema,body:reservationBody}},controller.updateReservation);
  app.patch("/trailers/:id/planned-departure",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["plannedDepartureDate"],properties:{plannedDepartureDate:optionalDate}}}},controller.plannedDeparture);
  app.delete("/trailers/:id/reservation",{schema:{params:idParamsSchema}},controller.releaseReservation);
  app.patch("/trailers/:id/inspection",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["nextInspectionDate"],properties:{nextInspectionDate:optionalDate}}}},controller.inspection);
  app.post("/trailers/:id/disable",{schema:{params:idParamsSchema,body:{type:"object",additionalProperties:false,required:["reason"],properties:{reason:{type:"string"},notes:{type:"string"}}}}},controller.disable);
  app.post("/trailers/:id/enable",{schema:{params:idParamsSchema}},controller.enable);
};
