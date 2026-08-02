import type { DatabaseSync } from "node:sqlite";
import type { Operator, OperatorInput } from "../models/settings.js";
import { booleanFromDatabase, requiredNumber, requiredString } from "./repositoryUtils.js";

const mapRow = (value: unknown): Operator => {
  const row = value as Record<string, unknown>;
  return { id: requiredString(row,"id"), code: requiredString(row,"code"), name: requiredString(row,"name"), active: booleanFromDatabase(row.active), sortOrder: requiredNumber(row,"sortOrder"), createdAt: requiredString(row,"createdAt"), updatedAt: requiredString(row,"updatedAt") };
};

export class OperatorRepository {
  constructor(private readonly database: DatabaseSync) {}
  list(): Operator[] { return this.database.prepare("SELECT * FROM Operators ORDER BY sortOrder, name").all().map(mapRow); }
  find(id: string): Operator | null { const row=this.database.prepare("SELECT * FROM Operators WHERE id=?").get(id);return row?mapRow(row):null; }
  create(input: OperatorInput): Operator { const id=input.id??crypto.randomUUID();const now=new Date().toISOString();this.database.prepare("INSERT INTO Operators (id,code,name,active,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)").run(id,input.code,input.name,input.active===false?0:1,input.sortOrder??0,now,now);return this.find(id)!; }
  update(id:string,input:OperatorInput):Operator|null { if(!this.find(id))return null;this.database.prepare("UPDATE Operators SET code=?,name=?,active=?,sortOrder=?,updatedAt=? WHERE id=?").run(input.code,input.name,input.active===false?0:1,input.sortOrder??0,new Date().toISOString(),id);return this.find(id); }
  setActive(id:string,active:boolean):Operator|null { if(!this.find(id))return null;this.database.prepare("UPDATE Operators SET active=?,updatedAt=? WHERE id=?").run(active?1:0,new Date().toISOString(),id);return this.find(id); }
  deactivate(id:string):Operator|null { if(!this.find(id))return null;this.database.prepare("UPDATE Operators SET active=0,updatedAt=? WHERE id=?").run(new Date().toISOString(),id);return this.find(id); }
}
