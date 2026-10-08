import type { DatabaseSync } from "node:sqlite";
import type { Operator, OperatorInput } from "../models/settings.js";
import { booleanFromDatabase, requiredNumber, requiredString } from "./repositoryUtils.js";
import { ApiError } from "../utils/apiError.js";

const mapRow = (value: unknown): Operator => {
  const row = value as Record<string, unknown>;
  return { id: requiredString(row,"id"), code: requiredString(row,"code"), name: requiredString(row,"name"), archived: booleanFromDatabase(row.archived), active: booleanFromDatabase(row.active), sortOrder: requiredNumber(row,"sortOrder"), createdAt: requiredString(row,"createdAt"), updatedAt: requiredString(row,"updatedAt") };
};

export class OperatorRepository {
  constructor(private readonly database: DatabaseSync) {}
  list(): Operator[] { return this.database.prepare("SELECT * FROM Operators ORDER BY sortOrder, name").all().map(mapRow); }
  find(id: string): Operator | null { const row=this.database.prepare("SELECT * FROM Operators WHERE id=?").get(id);return row?mapRow(row):null; }
  create(input: OperatorInput): Operator { const id=input.id??crypto.randomUUID();const now=new Date().toISOString();this.database.prepare("INSERT INTO Operators (id,code,name,active,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)").run(id,input.code,input.name,input.active===false?0:1,input.sortOrder??0,now,now);return this.find(id)!; }
  update(id:string,input:OperatorInput):Operator|null { const current=this.find(id);if(!current)return null;if(current.code!==input.code)throw new ApiError(409,"OPERATOR_CODE_IMMUTABLE","La sigla dell'operatore non può essere modificata");if(current.archived)throw new ApiError(409,"OPERATOR_ARCHIVED","Operatore rimosso");this.database.prepare("UPDATE Operators SET name=?,active=?,sortOrder=?,updatedAt=? WHERE id=?").run(input.name,input.active===false?0:1,input.sortOrder??0,new Date().toISOString(),id);return this.find(id); }
  setActive(id:string,active:boolean):Operator|null { const current=this.find(id);if(!current)return null;if(current.archived)throw new ApiError(409,"OPERATOR_ARCHIVED","Operatore rimosso");this.database.prepare("UPDATE Operators SET active=?,updatedAt=? WHERE id=?").run(active?1:0,new Date().toISOString(),id);return this.find(id); }
  remove(id:string):Operator|null {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const current=this.find(id);
      if(!current){this.database.exec("COMMIT");return null;}
      const open=this.database.prepare("SELECT 1 FROM LoadingSessions WHERE operatorId=? AND shippedAt IS NULL AND stato<>'SPEDITO' UNION ALL SELECT 1 FROM Packages WHERE operatoreId=? AND stato='APERTO' LIMIT 1").get(id,id);
      if(open)throw new ApiError(409,"OPERATOR_IN_USE","L'operatore ha operazioni aperte: completarle o assegnarle a un altro operatore prima della rimozione");
      const used=this.database.prepare("SELECT 1 FROM OperationalEvents WHERE operatorId=? UNION ALL SELECT 1 FROM Panels WHERE scannedByOperatorId=? UNION ALL SELECT 1 FROM Packages WHERE operatoreId=? UNION ALL SELECT 1 FROM LoadingSessions WHERE operatorId=? UNION ALL SELECT 1 FROM LoadingUnits WHERE loadedByOperatorId=? OR removedByOperatorId=? UNION ALL SELECT 1 FROM DeletedLoadAudit WHERE json_extract(eventJson,'$.operatorId')=? LIMIT 1").get(id,id,id,id,id,id,id);
      if(used)this.database.prepare("UPDATE Operators SET archived=1,active=0,updatedAt=? WHERE id=?").run(new Date().toISOString(),id);
      else this.database.prepare("DELETE FROM Operators WHERE id=?").run(id);
      const result=used?this.find(id)!:{...current,active:false,archived:true};
      this.database.exec("COMMIT");return result;
    }catch(error){this.database.exec("ROLLBACK");throw error;}
  }
}
