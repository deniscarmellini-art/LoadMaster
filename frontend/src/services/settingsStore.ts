import type { Operatore, Rimorchio, SettingsData, Trasportatore } from "../models/Settings";

export const SETTINGS_KEYS={
  operators:"loadmaster.settings.operators.v1",
  trailers:"loadmaster.settings.trailers.v1",
  carriers:"loadmaster.settings.carriers.v1",
} as const;
const VERSION=1;
const listeOperative:SettingsData["listeOperative"]=[
  {chiave:"DTP",valore:"Jlenia Pedrotti",descrizione:"Direttore tecnico di produzione",attivo:true},
  {chiave:"Aut-Min",valore:"59/15-CL",descrizione:"C. TRASF. Aut-Min.",attivo:true},
  {chiave:"Codice ETA",valore:"ETA-12/0362",descrizione:"Codice ETA",attivo:true},
];
let loadErrors:string[]=[];
const object=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
const strings=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==="string");
const operator=(value:unknown):value is Operatore=>object(value)&&strings(value,["id","nome","cognome","sigla"])&&typeof value.attivo==="boolean";
const trailer=(value:unknown):value is Rimorchio=>object(value)&&strings(value,["id","targa","descrizione","note"])&&typeof value.attivo==="boolean";
const carrier=(value:unknown):value is Trasportatore=>object(value)&&strings(value,["id","nome","note"])&&typeof value.attivo==="boolean";

function readRegistry<T>(key:string,label:string,guard:(value:unknown)=>value is T):T[]{
  const raw=localStorage.getItem(key);
  if(raw===null)return [];
  try{const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)||!parsed.every(guard))throw new Error("Formato non valido");return parsed;}
  catch{loadErrors.push(`${label}: dati locali non validi. Il contenuto originale non è stato cancellato.`);return [];}
}

export function loadSettings():SettingsData{
  loadErrors=[];
  return{
    operatori:readRegistry(SETTINGS_KEYS.operators,"Operatori",operator),
    rimorchi:readRegistry(SETTINGS_KEYS.trailers,"Rimorchi",trailer),
    trasportatori:readRegistry(SETTINGS_KEYS.carriers,"Trasportatori",carrier),
    listeOperative,
  };
}
export const getSettingsLoadErrors=()=>[...loadErrors];
export function saveSettings(next:SettingsData,previous?:SettingsData){
  try{
    if(!previous||next.operatori!==previous.operatori)localStorage.setItem(SETTINGS_KEYS.operators,JSON.stringify(next.operatori));
    if(!previous||next.rimorchi!==previous.rimorchi)localStorage.setItem(SETTINGS_KEYS.trailers,JSON.stringify(next.rimorchi));
    if(!previous||next.trasportatori!==previous.trasportatori)localStorage.setItem(SETTINGS_KEYS.carriers,JSON.stringify(next.trasportatori));
  }catch(error){console.error("Impossibile salvare le anagrafiche locali",error);throw error;}
}
export const createRegistryId=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;
export interface SettingsBackup{version:number;exportedAt:string;operatori:Operatore[];rimorchi:Rimorchio[];trasportatori:Trasportatore[]}
export const createSettingsBackup=(settings:SettingsData):SettingsBackup=>({version:VERSION,exportedAt:new Date().toISOString(),operatori:settings.operatori,rimorchi:settings.rimorchi,trasportatori:settings.trasportatori});
export function parseSettingsBackup(text:string):SettingsBackup{
  const parsed:unknown=JSON.parse(text);
  if(!object(parsed)||parsed.version!==VERSION||typeof parsed.exportedAt!=="string"||!Array.isArray(parsed.operatori)||!parsed.operatori.every(operator)||!Array.isArray(parsed.rimorchi)||!parsed.rimorchi.every(trailer)||!Array.isArray(parsed.trasportatori)||!parsed.trasportatori.every(carrier))throw new Error("Il file non è un backup LoadMaster valido");
  return{version:VERSION,exportedAt:parsed.exportedAt,operatori:parsed.operatori,rimorchi:parsed.rimorchi,trasportatori:parsed.trasportatori};
}
