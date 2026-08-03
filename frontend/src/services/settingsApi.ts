import type { ImpostazioneOperativa, Operatore, Rimorchio, SettingsData, Trasportatore } from "../models/Settings";
import { apiRequest } from "./apiClient";

interface ApiBase { id:string;active:boolean;sortOrder:number;createdAt:string;updatedAt:string }
interface ApiOperator extends ApiBase { code:string;name:string }
interface ApiTrailer extends ApiBase { plate:string;description:string;nextInspectionDate:string|null }
interface ApiCarrier extends ApiBase { name:string }
interface ApiOperationalSetting { key:string;value:string;description:string;active:boolean;sortOrder:number;createdAt:string;updatedAt:string }

const splitName=(fullName:string):Pick<Operatore,"nome"|"cognome">=>{const [nome="",...rest]=fullName.trim().split(/\s+/);return{nome,cognome:rest.join(" ")};};
const fromOperator=(item:ApiOperator):Operatore=>({id:item.id,sigla:item.code,...splitName(item.name),attivo:item.active});
const fromTrailer=(item:ApiTrailer):Rimorchio=>({id:item.id,targa:item.plate,descrizione:item.description,note:"",attivo:item.active,...(item.nextInspectionDate?{prossimaRevisione:item.nextInspectionDate}:{})});
const fromCarrier=(item:ApiCarrier):Trasportatore=>({id:item.id,nome:item.name,note:"",attivo:item.active});
const fromOperationalSetting=(item:ApiOperationalSetting):ImpostazioneOperativa=>({chiave:item.key,valore:item.value,descrizione:item.description,attivo:item.active});
const body=(value:unknown)=>JSON.stringify(value);

export const loadSettingsFromApi=async():Promise<SettingsData>=>{
  const [operators,trailers,carriers,operationalSettings]=await Promise.all([apiRequest<ApiOperator[]>("/operators"),apiRequest<ApiTrailer[]>("/trailers"),apiRequest<ApiCarrier[]>("/carriers"),apiRequest<ApiOperationalSetting[]>("/operational-settings")]);
  return{operatori:operators.map(fromOperator),rimorchi:trailers.map(fromTrailer),trasportatori:carriers.map(fromCarrier),listeOperative:operationalSettings.map(fromOperationalSetting)};
};

const syncRegistry=async<T extends {id:string;attivo:boolean},A>(current:T[],next:T[],path:string,toApi:(item:T,index:number)=>A):Promise<void>=>{
  const currentById=new Map(current.map(item=>[item.id,item]));
  const nextIds=new Set(next.map(item=>item.id));
  await Promise.all(current.filter(item=>!nextIds.has(item.id)).map(item=>apiRequest(`${path}/${encodeURIComponent(item.id)}`,{method:"DELETE"})));
  await Promise.all(next.map((item,index)=>{const previous=currentById.get(item.id);if(!previous)return apiRequest(path,{method:"POST",body:body(toApi(item,index))});if(JSON.stringify(previous)===JSON.stringify(item))return Promise.resolve();const {attivo:previousActive,...previousData}=previous;const {attivo:nextActive,...nextData}=item;const onlyActiveChanged=JSON.stringify(previousData)===JSON.stringify(nextData)&&previousActive!==nextActive;return onlyActiveChanged?apiRequest(`${path}/${encodeURIComponent(item.id)}`,{method:"PATCH",body:body({active:item.attivo})}):apiRequest(`${path}/${encodeURIComponent(item.id)}`,{method:"PUT",body:body(toApi(item,index))});}));
};

const syncOperationalSettings=async(current:ImpostazioneOperativa[],next:ImpostazioneOperativa[]):Promise<void>=>{
  const currentByKey=new Map(current.map(item=>[item.chiave,item]));
  const nextKeys=new Set(next.map(item=>item.chiave));
  await Promise.all(current.filter(item=>!nextKeys.has(item.chiave)).map(item=>apiRequest(`/operational-settings/${encodeURIComponent(item.chiave)}`,{method:"DELETE"})));
  await Promise.all(next.map((item,index)=>{const previous=currentByKey.get(item.chiave);const payload={key:item.chiave,value:item.valore.trim(),description:item.descrizione.trim(),active:item.attivo,sortOrder:index};if(!previous)return apiRequest("/operational-settings",{method:"POST",body:body(payload)});if(JSON.stringify(previous)===JSON.stringify(item))return Promise.resolve();const onlyActiveChanged=previous.valore===item.valore&&previous.descrizione===item.descrizione&&previous.attivo!==item.attivo;return onlyActiveChanged?apiRequest(`/operational-settings/${encodeURIComponent(item.chiave)}`,{method:"PATCH",body:body({active:item.attivo})}):apiRequest(`/operational-settings/${encodeURIComponent(item.chiave)}`,{method:"PUT",body:body(payload)}); }));
};

export const saveSettingsToApi=async(next:SettingsData,previous:SettingsData):Promise<SettingsData>=>{
  await Promise.all([
    syncRegistry(previous.operatori,next.operatori,"/operators",(item,index)=>({id:item.id,code:item.sigla.trim(),name:`${item.nome} ${item.cognome}`.trim(),active:item.attivo,sortOrder:index})),
    syncRegistry(previous.rimorchi,next.rimorchi,"/trailers",(item,index)=>({id:item.id,plate:item.targa.trim(),description:item.descrizione.trim(),active:item.attivo,sortOrder:index,nextInspectionDate:item.prossimaRevisione||null})),
    syncRegistry(previous.trasportatori,next.trasportatori,"/carriers",(item,index)=>({id:item.id,name:item.nome.trim(),active:item.attivo,sortOrder:index})),
    syncOperationalSettings(previous.listeOperative,next.listeOperative),
  ]);
  return loadSettingsFromApi();
};
