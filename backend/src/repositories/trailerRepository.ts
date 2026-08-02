import type { DatabaseSync } from "node:sqlite";
import type { Trailer, TrailerInput } from "../models/settings.js";
import { booleanFromDatabase, requiredNumber, requiredString } from "./repositoryUtils.js";

const mapRow=(value:unknown):Trailer=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),plate:requiredString(row,"plate"),description:requiredString(row,"description"),active:booleanFromDatabase(row.active),sortOrder:requiredNumber(row,"sortOrder"),createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
export class TrailerRepository{
 constructor(private readonly database:DatabaseSync){}
 list():Trailer[]{return this.database.prepare("SELECT * FROM Trailers ORDER BY sortOrder, plate").all().map(mapRow);}
 find(id:string):Trailer|null{const row=this.database.prepare("SELECT * FROM Trailers WHERE id=?").get(id);return row?mapRow(row):null;}
 create(input:TrailerInput):Trailer{const id=input.id??crypto.randomUUID();const now=new Date().toISOString();this.database.prepare("INSERT INTO Trailers (id,plate,description,active,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)").run(id,input.plate,input.description,input.active===false?0:1,input.sortOrder??0,now,now);return this.find(id)!;}
 update(id:string,input:TrailerInput):Trailer|null{if(!this.find(id))return null;this.database.prepare("UPDATE Trailers SET plate=?,description=?,active=?,sortOrder=?,updatedAt=? WHERE id=?").run(input.plate,input.description,input.active===false?0:1,input.sortOrder??0,new Date().toISOString(),id);return this.find(id);}
 deactivate(id:string):Trailer|null{if(!this.find(id))return null;this.database.prepare("UPDATE Trailers SET active=0,updatedAt=? WHERE id=?").run(new Date().toISOString(),id);return this.find(id);}
}
