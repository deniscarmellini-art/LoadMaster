import type { DatabaseSync } from "node:sqlite";
import type { Carrier, CarrierInput } from "../models/settings.js";
import { booleanFromDatabase, requiredNumber, requiredString } from "./repositoryUtils.js";

const mapRow=(value:unknown):Carrier=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),name:requiredString(row,"name"),active:booleanFromDatabase(row.active),sortOrder:requiredNumber(row,"sortOrder"),createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
export class CarrierRepository{
 constructor(private readonly database:DatabaseSync){}
 list():Carrier[]{return this.database.prepare("SELECT * FROM Carriers ORDER BY sortOrder, name").all().map(mapRow);}
 find(id:string):Carrier|null{const row=this.database.prepare("SELECT * FROM Carriers WHERE id=?").get(id);return row?mapRow(row):null;}
 create(input:CarrierInput):Carrier{const id=input.id??crypto.randomUUID();const now=new Date().toISOString();this.database.prepare("INSERT INTO Carriers (id,name,active,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?)").run(id,input.name,input.active===false?0:1,input.sortOrder??0,now,now);return this.find(id)!;}
 update(id:string,input:CarrierInput):Carrier|null{if(!this.find(id))return null;this.database.prepare("UPDATE Carriers SET name=?,active=?,sortOrder=?,updatedAt=? WHERE id=?").run(input.name,input.active===false?0:1,input.sortOrder??0,new Date().toISOString(),id);return this.find(id);}
 deactivate(id:string):Carrier|null{if(!this.find(id))return null;this.database.prepare("UPDATE Carriers SET active=0,updatedAt=? WHERE id=?").run(new Date().toISOString(),id);return this.find(id);}
}
