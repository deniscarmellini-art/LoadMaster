import type { Operatore, Rimorchio, SettingsData, Trasportatore } from "../models/Settings";

const VERSION=1;
const listeOperative:SettingsData["listeOperative"]=[
  {chiave:"DTP",valore:"Jlenia Pedrotti",descrizione:"Direttore tecnico di produzione",attivo:true},
  {chiave:"Aut-Min",valore:"59/15-CL",descrizione:"C. TRASF. Aut-Min.",attivo:true},
  {chiave:"Codice ETA",valore:"ETA-12/0362",descrizione:"Codice ETA",attivo:true},
  {chiave:"CPR",valore:"0809-CPR-1049",descrizione:"CPR",attivo:true},
];
const object=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
const strings=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==="string");
const operator=(value:unknown):value is Operatore=>object(value)&&strings(value,["id","nome","cognome","sigla"])&&typeof value.attivo==="boolean";
const trailer=(value:unknown):value is Rimorchio=>object(value)&&strings(value,["id","targa","descrizione","note"])&&typeof value.attivo==="boolean";
const carrier=(value:unknown):value is Trasportatore=>object(value)&&strings(value,["id","nome","note"])&&typeof value.attivo==="boolean";

export const loadSettings=():SettingsData=>({operatori:[],rimorchi:[],trasportatori:[],listeOperative});
export const createRegistryId=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;
export interface SettingsBackup{version:number;exportedAt:string;operatori:Operatore[];rimorchi:Rimorchio[];trasportatori:Trasportatore[]}
export const createSettingsBackup=(settings:SettingsData):SettingsBackup=>({version:VERSION,exportedAt:new Date().toISOString(),operatori:settings.operatori,rimorchi:settings.rimorchi,trasportatori:settings.trasportatori});
export function parseSettingsBackup(text:string):SettingsBackup{
  const parsed:unknown=JSON.parse(text);
  if(!object(parsed)||parsed.version!==VERSION||typeof parsed.exportedAt!=="string"||!Array.isArray(parsed.operatori)||!parsed.operatori.every(operator)||!Array.isArray(parsed.rimorchi)||!parsed.rimorchi.every(trailer)||!Array.isArray(parsed.trasportatori)||!parsed.trasportatori.every(carrier))throw new Error("Il file non è un backup LoadMaster valido");
  return{version:VERSION,exportedAt:parsed.exportedAt,operatori:parsed.operatori,rimorchi:parsed.rimorchi,trasportatori:parsed.trasportatori};
}
