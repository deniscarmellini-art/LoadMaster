import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { customerFields,type CustomerData,type CustomerRecord,type CustomerImportRow,type CustomerPreviewRow } from "../models/customer.js";
import { ApiError } from "../utils/apiError.js";

const nameKey=(v:string)=>v.trim().replace(/\s+/g," ").toLocaleLowerCase("it-IT");
const taxKey=(v:string)=>v.replace(/[^\p{L}\p{N}]/gu,"").toLocaleUpperCase("it-IT");
const same=(a:CustomerData,b:CustomerData)=>customerFields.every(f=>a[f]===b[f]);
const related=(a:CustomerData,b:CustomerData)=>nameKey(a.denominazione)===nameKey(b.denominazione)||
 Boolean(taxKey(a.partitaIva)&&taxKey(a.partitaIva)===taxKey(b.partitaIva))||Boolean(taxKey(a.codiceFiscale)&&taxKey(a.codiceFiscale)===taxKey(b.codiceFiscale));
export function validateCustomer(input:CustomerData):CustomerData {
 const data={} as CustomerData;
 for(const field of customerFields){if(typeof input[field]!=="string"||input[field].length>1000)throw new ApiError(400,"VALIDATION_ERROR",`Campo ${field} non valido`);data[field]=input[field].trim();}
 if(!data.denominazione)throw new ApiError(400,"VALIDATION_ERROR","Denominazione obbligatoria");
 // Preserve the source text, accepting both address lists and display names.
 const emails=data.email.replace(/[^<>,;]*<([^<>]+)>/g,"$1").split(/[;,\s]+/).filter(Boolean);
 if(data.email&&(!emails.length||emails.some(email=>!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))))throw new ApiError(400,"VALIDATION_ERROR","eMail non valida");
 return data;
}
export class CustomerRepository {
 private previews=new Map<string,{expires:number;revision:string;rows:CustomerPreviewRow[];report?:unknown}>();
 constructor(private db:DatabaseSync){}
 list():CustomerRecord[]{return this.db.prepare("SELECT * FROM Customers ORDER BY denominazione,id").all() as unknown as CustomerRecord[];}
 private revision(){return createHash("sha256").update(JSON.stringify(this.list())).digest("hex");}
 private transaction<T>(fn:()=>T):T{this.db.exec("BEGIN IMMEDIATE");try{const result=fn();this.db.exec("COMMIT");return result;}catch(error){this.db.exec("ROLLBACK");throw error;}}
 private unique(data:CustomerData,id?:string){if(this.list().some(c=>c.id!==id&&related(c,data)))throw new ApiError(409,"CUSTOMER_DUPLICATE","Cliente o identificativo già presente: verificare l'anagrafica esistente");}
 private insert(data:CustomerData):CustomerRecord{this.unique(data);const id=crypto.randomUUID(),now=new Date().toISOString();this.db.prepare(`INSERT INTO Customers(id,${customerFields.join(",")},createdAt,updatedAt) VALUES(${Array(14).fill("?").join(",")})`).run(id,...customerFields.map(f=>data[f]),now,now);return this.list().find(c=>c.id===id)!;}
 private replace(id:string,data:CustomerData,expectedUpdatedAt:string):CustomerRecord {
  const old=this.list().find(c=>c.id===id);if(!old)throw new ApiError(404,"RESOURCE_NOT_FOUND","Cliente non trovato");
  if(old.updatedAt!==expectedUpdatedAt)throw new ApiError(409,"CUSTOMER_STALE","Cliente modificato da un'altra postazione: ricaricare la scheda");
  this.unique(data,id);if(same(old,data))return old;
  const now=new Date(Math.max(Date.now(),Date.parse(old.updatedAt)+1)).toISOString();
  this.db.prepare(`UPDATE Customers SET ${customerFields.map(f=>`${f}=?`).join(",")},updatedAt=? WHERE id=?`).run(...customerFields.map(f=>data[f]),now,id);return this.list().find(c=>c.id===id)!;
 }
 create(input:CustomerData){const data=validateCustomer(input);return this.transaction(()=>this.insert(data));}
 update(id:string,input:CustomerData,expectedUpdatedAt:string){const data=validateCustomer(input);return this.transaction(()=>this.replace(id,data,expectedUpdatedAt));}
 preview(input:CustomerImportRow[]){
  const existing=this.list();
  const normalized=input.map(row=>{try{return {...row,data:validateCustomer(row.data)};}catch{return row;}});
  const identities=(data:CustomerData)=>[
   `name:${nameKey(data.denominazione)}`,
   ...(taxKey(data.partitaIva)?[`vat:${taxKey(data.partitaIva)}`]:[]),
   ...(taxKey(data.codiceFiscale)?[`cf:${taxKey(data.codiceFiscale)}`]:[]),
  ];
  const groups=new Map<string,{first:number;fingerprint:string;conflicting:boolean}>();
  normalized.forEach((row,index)=>{const fingerprint=JSON.stringify(customerFields.map(f=>row.data[f]));for(const id of identities(row.data)){const group=groups.get(id);if(group){if(group.fingerprint!==fingerprint)group.conflicting=true;}else groups.set(id,{first:index,fingerprint,conflicting:false});}});
  const existingIndex=new Map<string,CustomerRecord[]>();
  for(const customer of existing)for(const id of identities(customer))existingIndex.set(id,[...(existingIndex.get(id)??[]),customer]);
  const rows:CustomerPreviewRow[]=normalized.map((row,index)=>{
   const result=(status:CustomerPreviewRow["status"],message:string,customerId?:string):CustomerPreviewRow=>({...row,status,message,...(customerId?{customerId,existing:existing.find(c=>c.id===customerId)!}:{})});
   try{validateCustomer(row.data);}catch(error){return result("INVALID",error instanceof Error?error.message:"Riga non valida");}
   if(row.issues?.length)return result("INVALID",row.issues.join("; "));
   const rowGroups=identities(row.data).map(id=>groups.get(id)!);
   if(rowGroups.some(group=>group.conflicting))return result("AMBIGUOUS","Identità ripetuta con dati differenti nel file: nessuna scrittura");
   if(rowGroups.some(group=>group.first<index))return result("DUPLICATE_FILE","Riga identica già presente nel file");
   const hard=[...new Map(identities(row.data).filter(id=>!id.startsWith("name:")).flatMap(id=>existingIndex.get(id)??[]).map(c=>[c.id,c])).values()];
   if(hard.length>1)return result("AMBIGUOUS","Gli identificativi indicano clienti diversi");
   if(hard.length===1){const customer=hard[0]!;
    if((customer.partitaIva&&row.data.partitaIva&&taxKey(customer.partitaIva)!==taxKey(row.data.partitaIva))||(customer.codiceFiscale&&row.data.codiceFiscale&&taxKey(customer.codiceFiscale)!==taxKey(row.data.codiceFiscale)))return result("AMBIGUOUS","Identificativi fiscali in conflitto");
    if((existingIndex.get(`name:${nameKey(row.data.denominazione)}`)??[]).some(c=>c.id!==customer.id))return result("AMBIGUOUS","Denominazione già associata a un altro cliente");
    return result(same(customer,row.data)?"UNCHANGED":"UPDATE",same(customer,row.data)?"Già presente, nessuna modifica":"Differenze rilevate: aggiornamento solo se selezionato esplicitamente",customer.id);
   }
   const names=existingIndex.get(`name:${nameKey(row.data.denominazione)}`)??[];
   if(names.length===1&&same(names[0]!,row.data))return result("UNCHANGED","Già presente, nessuna modifica",names[0]!.id);
   if(names.length)return result("POSSIBLE_DUPLICATE","Denominazione simile senza identificazione certa: verificare manualmente");
   return result("NEW","Nuovo cliente");
  });
  for(const [token,p] of this.previews)if(p.expires<Date.now())this.previews.delete(token);
  if(this.previews.size>=20)this.previews.delete(this.previews.keys().next().value!);
  const token=crypto.randomUUID();this.previews.set(token,{expires:Date.now()+15*60_000,revision:createHash("sha256").update(JSON.stringify(existing)).digest("hex"),rows});
  return {token,rows};
 }
 confirm(token:string,updateRows:number[]){
  const preview=this.previews.get(token);if(!preview||preview.expires<Date.now())throw new ApiError(409,"IMPORT_EXPIRED","Anteprima scaduta: rileggere il file");
  if(preview.report)return preview.report;
  if(new Set(updateRows).size!==updateRows.length||updateRows.some(n=>!preview.rows.some(r=>r.rowNumber===n&&r.status==="UPDATE")))throw new ApiError(400,"VALIDATION_ERROR","Selezione aggiornamenti non valida");
  const report=this.transaction(()=>{
   if(this.revision()!==preview.revision)throw new ApiError(409,"IMPORT_STALE","Anagrafica modificata dopo l'anteprima: ripetere la verifica");
   let inserted=0,updated=0,unchanged=0,discarded=0;
   const rows=preview.rows.map(row=>{
    if(row.status==="NEW"){this.insert(row.data);inserted++;return{rowNumber:row.rowNumber,status:"INSERTED",message:"Inserito"};}
    if(row.status==="UPDATE"&&updateRows.includes(row.rowNumber)){const old=this.list().find(c=>c.id===row.customerId)!;this.replace(old.id,row.data,old.updatedAt);updated++;return{rowNumber:row.rowNumber,status:"UPDATED",message:"Aggiornato su conferma esplicita"};}
    if(row.status==="UNCHANGED"){unchanged++;return{rowNumber:row.rowNumber,status:"UNCHANGED",message:row.message};}
    discarded++;return{rowNumber:row.rowNumber,status:"DISCARDED",message:row.status==="UPDATE"?"Aggiornamento non selezionato":row.message};
   });return{inserted,updated,unchanged,discarded,rows};
  });preview.report=report;return report;
 }
}
