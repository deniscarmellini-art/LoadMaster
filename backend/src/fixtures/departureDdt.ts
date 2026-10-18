import { DatabaseSync } from "node:sqlite";
import { relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync,rmSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/environment.js";
import { buildApp as application } from "../app.js";
import { DefinitiveDdtRepository, pdfHash, type DefinitiveDdt } from "../repositories/definitiveDdtRepository.js";

/** Synthetic archive fixture for existing departure tests; never use on an application database.
 * Issuance validation and actual PDFs are covered by issuedDdt.test.ts.
 */
export function seedDepartureDdt(db:DatabaseSync, sessionId:string):void {
  const file=String(db.prepare("PRAGMA database_list").all().find(row=>row.name==="main")?.file??"");
  const path=relative(tmpdir(),file);
  if(file&&(path.startsWith("..")||isAbsolute(path)))throw new Error("Departure fixture requires a temporary database");
  const repo=new DefinitiveDdtRepository(db);
  if(repo.valid(sessionId))return;
  repo.transaction(()=>{
    const session=db.prepare("SELECT * FROM LoadingSessions WHERE id=?").get(sessionId)!;
    const operator=String(db.prepare("SELECT id FROM Operators WHERE active=1 LIMIT 1").get()!.id);
    const id=crypto.randomUUID(),year=2026,sequence=repo.nextNumber(year),pdf=Buffer.from("%PDF-SYNTHETIC-DEPARTURE-TEST");
    const doc:DefinitiveDdt={id,loadingSessionId:sessionId,loadId:String(session.loadId),sequence,year,fullNumber:`X-Lam/${String(sequence).padStart(4,"0")}/${year}`,
      issuedAt:"2026-10-18T10:00:00Z",documentDate:"2026-10-18",issuedByOperatorId:operator,status:"EMESSO",cancelledAt:null,cancelledByOperatorId:null,cancellationReason:null,replacedByDdtId:null,
      snapshotVersion:1,snapshotJson:JSON.stringify({fixture:"departure regression only"}),pdfReference:`sqlite:ddt/${id}`,pdfSha256:pdfHash(pdf)};
    repo.insert(doc,pdf);
  });
}
export function seedDepartureDdtAt(path:string,sessionId:string):void {
  const db=new DatabaseSync(path);try{seedDepartureDdt(db,sessionId);}finally{db.close();}
}
const databases=new WeakMap<FastifyInstance,string>(),ownedDirectories=new Set<string>();
process.once("exit",()=>{for(const path of ownedDirectories)rmSync(path,{recursive:true,force:true});});
/** Test-only app factory: exposes no HTTP helpers and never uses a workspace database. */
export async function buildApp(config:AppConfig):Promise<FastifyInstance>{
  let databasePath=config.databasePath;
  if(databasePath===":memory:"){const dir=mkdtempSync(join(tmpdir(),"sislog-departure-fixture-"));ownedDirectories.add(dir);databasePath=join(dir,"test.sqlite");}
  const app=await application({...config,databasePath});databases.set(app,databasePath);return app;
}
export function seedDepartureDdtForApp(app:FastifyInstance,sessionId:string,carrierId?:string):void{
  const path=databases.get(app);if(!path)throw new Error("Use the isolated departure test app factory");
  const db=new DatabaseSync(path);try{
    if(carrierId)db.prepare("UPDATE LoadingSessions SET carrierId=? WHERE id=?").run(carrierId,sessionId);
    seedDepartureDdt(db,sessionId);
  }finally{db.close();}
}
