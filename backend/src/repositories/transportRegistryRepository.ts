import type { DatabaseSync } from "node:sqlite";
import type { TransportRegistryEntry,TransportRegistryInput } from "../models/settings.js";
import { booleanFromDatabase,requiredNumber,requiredString } from "./repositoryUtils.js";

type RegistryTable="ClientVehicleTypes"|"ThirdPartyTransportModes";
const mapRow=(value:unknown):TransportRegistryEntry=>{const row=value as Record<string,unknown>;return{id:requiredString(row,"id"),name:requiredString(row,"name"),active:booleanFromDatabase(row.active),sortOrder:requiredNumber(row,"sortOrder"),createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};

export class TransportRegistryRepository{
 constructor(private readonly database:DatabaseSync,private readonly table:RegistryTable){}
 list():TransportRegistryEntry[]{return this.database.prepare(`SELECT * FROM ${this.table} ORDER BY sortOrder,name`).all().map(mapRow);}
 find(id:string):TransportRegistryEntry|null{const row=this.database.prepare(`SELECT * FROM ${this.table} WHERE id=?`).get(id);return row?mapRow(row):null;}
 create(input:TransportRegistryInput):TransportRegistryEntry{const id=input.id??crypto.randomUUID(),now=new Date().toISOString();this.database.prepare(`INSERT INTO ${this.table}(id,name,active,sortOrder,createdAt,updatedAt) VALUES(?,?,?,?,?,?)`).run(id,input.name,input.active===false?0:1,input.sortOrder??0,now,now);return this.find(id)!;}
 update(id:string,input:TransportRegistryInput):TransportRegistryEntry|null{if(!this.find(id))return null;this.database.prepare(`UPDATE ${this.table} SET name=?,active=?,sortOrder=?,updatedAt=? WHERE id=?`).run(input.name,input.active===false?0:1,input.sortOrder??0,new Date().toISOString(),id);return this.find(id);}
 setActive(id:string,active:boolean):TransportRegistryEntry|null{if(!this.find(id))return null;this.database.prepare(`UPDATE ${this.table} SET active=?,updatedAt=? WHERE id=?`).run(active?1:0,new Date().toISOString(),id);return this.find(id);}
 deactivate(id:string):TransportRegistryEntry|null{return this.setActive(id,false);}
}
