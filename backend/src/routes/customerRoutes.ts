import type { FastifyPluginAsync } from "fastify";
import { CustomerRepository } from "../repositories/customerRepository.js";
import { customerFields,type CustomerData,type CustomerImportRow } from "../models/customer.js";
import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "../utils/apiError.js";
const properties=Object.fromEntries(customerFields.map(f=>[f,{type:"string",maxLength:1000}]));
const data={type:"object",additionalProperties:false,required:[...customerFields],properties};
const row={type:"object",additionalProperties:false,required:["rowNumber","data"],properties:{rowNumber:{type:"integer",minimum:1},data,issues:{type:"array",maxItems:20,items:{type:"string",maxLength:1000}},warnings:{type:"array",maxItems:20,items:{type:"string",maxLength:1000}}}};
export const customerRoutes:FastifyPluginAsync<{database:DatabaseSync}>=async(app,{database})=>{
 const repo=new CustomerRepository(database);
 // Fastify normally coerces scalar values. Reject numeric customer fields before
 // schema coercion so identifiers cannot silently lose their string semantics.
 app.addHook("preValidation",async request=>{
  const body=request.body as {rows?:Array<{data?:Record<string,unknown>}>}|undefined;
  const records=Array.isArray(body?.rows)?body.rows.map(row=>row.data):[body];
  for(const record of records)if(record&&typeof record==="object")for(const field of customerFields)
   if(field in record&&typeof (record as Record<string,unknown>)[field]!=="string")throw new ApiError(400,"VALIDATION_ERROR",`Campo ${field}: usare una stringa di testo`);
 });
 app.get("",async()=>repo.list());
 app.post<{Body:CustomerData}>("",{schema:{body:data}},async(req,reply)=>reply.code(201).send(repo.create(req.body)));
 app.put<{Params:{id:string};Body:CustomerData&{expectedUpdatedAt:string}}>("/:id",{schema:{params:{type:"object",required:["id"],properties:{id:{type:"string",minLength:1}}},body:{...data,required:[...customerFields,"expectedUpdatedAt"],properties:{...properties,expectedUpdatedAt:{type:"string",minLength:1}}}}},async req=>repo.update(req.params.id,req.body,req.body.expectedUpdatedAt));
 app.post<{Body:{rows:CustomerImportRow[]}}>("/import/preview",{bodyLimit:10*1024*1024,schema:{body:{type:"object",additionalProperties:false,required:["rows"],properties:{rows:{type:"array",minItems:1,maxItems:10000,items:row}}}}},async req=>{
  if(new Set(req.body.rows.map(r=>r.rowNumber)).size!==req.body.rows.length)throw new ApiError(400,"VALIDATION_ERROR","Numeri di riga duplicati");
  return repo.preview(req.body.rows);
 });
 app.post<{Body:{token:string;confirmed:boolean;updateRows:number[]}}>("/import/confirm",{schema:{body:{type:"object",additionalProperties:false,required:["token","confirmed","updateRows"],properties:{token:{type:"string",minLength:1},confirmed:{const:true},updateRows:{type:"array",maxItems:10000,items:{type:"integer",minimum:1}}}}}},async req=>repo.confirm(req.body.token,req.body.updateRows));
};
