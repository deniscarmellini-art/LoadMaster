import type { DatabaseSync } from "node:sqlite";
import type { OperationalSetting, OperationalSettingInput } from "../models/settings.js";
import { booleanFromDatabase, requiredNumber, requiredString } from "./repositoryUtils.js";

const mapRow=(value:unknown):OperationalSetting=>{const row=value as Record<string,unknown>;return{key:requiredString(row,"key"),value:requiredString(row,"value"),description:requiredString(row,"description"),active:booleanFromDatabase(row.active),sortOrder:requiredNumber(row,"sortOrder"),createdAt:requiredString(row,"createdAt"),updatedAt:requiredString(row,"updatedAt")};};
export class OperationalSettingRepository{
  constructor(private readonly database:DatabaseSync){}
  list():OperationalSetting[]{return this.database.prepare("SELECT * FROM OperationalSettings ORDER BY sortOrder, key").all().map(mapRow);}
  find(key:string):OperationalSetting|null{const row=this.database.prepare("SELECT * FROM OperationalSettings WHERE key=?").get(key);return row?mapRow(row):null;}
  create(input:OperationalSettingInput):OperationalSetting{const now=new Date().toISOString();this.database.prepare("INSERT INTO OperationalSettings (key,value,description,active,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)").run(input.key,input.value,input.description,input.active===false?0:1,input.sortOrder??0,now,now);return this.find(input.key)!;}
  update(key:string,input:OperationalSettingInput):OperationalSetting|null{if(!this.find(key))return null;this.database.prepare("UPDATE OperationalSettings SET value=?,description=?,active=?,sortOrder=?,updatedAt=? WHERE key=?").run(input.value,input.description,input.active===false?0:1,input.sortOrder??0,new Date().toISOString(),key);return this.find(key);}
  setActive(key:string,active:boolean):OperationalSetting|null{if(!this.find(key))return null;this.database.prepare("UPDATE OperationalSettings SET active=?,updatedAt=? WHERE key=?").run(active?1:0,new Date().toISOString(),key);return this.find(key);}
  deactivate(key:string):OperationalSetting|null{return this.setActive(key,false);}
}
