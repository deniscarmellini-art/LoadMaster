import type { Operatore, Rimorchio, SettingsData, Trasportatore } from "../models/Settings";
import { apiRequest } from "./apiClient";

interface ApiBase { id:string;active:boolean;sortOrder:number;createdAt:string;updatedAt:string }
interface ApiOperator extends ApiBase { code:string;name:string }
interface ApiTrailer extends ApiBase { plate:string;description:string }
interface ApiCarrier extends ApiBase { name:string }

const splitName=(fullName:string):Pick<Operatore,"nome"|"cognome">=>{const [nome="",...rest]=fullName.trim().split(/\s+/);return{nome,cognome:rest.join(" ")};};
const fromOperator=(item:ApiOperator):Operatore=>({id:item.id,sigla:item.code,...splitName(item.name),attivo:item.active});
const fromTrailer=(item:ApiTrailer):Rimorchio=>({id:item.id,targa:item.plate,descrizione:item.description,note:"",attivo:item.active});
const fromCarrier=(item:ApiCarrier):Trasportatore=>({id:item.id,nome:item.name,note:"",attivo:item.active});
const body=(value:unknown)=>JSON.stringify(value);

export const loadSettingsFromApi=async(listeOperative:SettingsData["listeOperative"]):Promise<SettingsData>=>{
  const [operators,trailers,carriers]=await Promise.all([apiRequest<ApiOperator[]>("/operators"),apiRequest<ApiTrailer[]>("/trailers"),apiRequest<ApiCarrier[]>("/carriers")]);
  return{operatori:operators.map(fromOperator),rimorchi:trailers.map(fromTrailer),trasportatori:carriers.map(fromCarrier),listeOperative};
};

const syncRegistry=async<T extends {id:string},A>(current:T[],next:T[],path:string,toApi:(item:T,index:number)=>A):Promise<void>=>{
  const currentById=new Map(current.map(item=>[item.id,item]));
  const nextIds=new Set(next.map(item=>item.id));
  await Promise.all(current.filter(item=>!nextIds.has(item.id)).map(item=>apiRequest(`${path}/${encodeURIComponent(item.id)}`,{method:"DELETE"})));
  await Promise.all(next.map((item,index)=>{const previous=currentById.get(item.id);const payload=body(toApi(item,index));return previous?(JSON.stringify(previous)===JSON.stringify(item)?Promise.resolve():apiRequest(`${path}/${encodeURIComponent(item.id)}`,{method:"PUT",body:payload})):apiRequest(path,{method:"POST",body:payload});}));
};

export const saveSettingsToApi=async(next:SettingsData,previous:SettingsData):Promise<SettingsData>=>{
  await Promise.all([
    syncRegistry(previous.operatori,next.operatori,"/operators",(item,index)=>({id:item.id,code:item.sigla.trim(),name:`${item.nome} ${item.cognome}`.trim(),active:item.attivo,sortOrder:index})),
    syncRegistry(previous.rimorchi,next.rimorchi,"/trailers",(item,index)=>({id:item.id,plate:item.targa.trim(),description:item.descrizione.trim(),active:item.attivo,sortOrder:index})),
    syncRegistry(previous.trasportatori,next.trasportatori,"/carriers",(item,index)=>({id:item.id,name:item.nome.trim(),active:item.attivo,sortOrder:index})),
  ]);
  return loadSettingsFromApi(next.listeOperative);
};
