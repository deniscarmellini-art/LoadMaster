import type { SettingsData } from "../models/Settings";

const STORAGE_KEY="loadmaster.settings.v1";
export const defaultSettings:SettingsData={operatori:[],rimorchi:[],trasportatori:[],listeOperative:[
  {chiave:"DTP",valore:"Jlenia Pedrotti",descrizione:"Direttore tecnico di produzione",attivo:true},
  {chiave:"Aut-Min",valore:"59/15-CL",descrizione:"C. TRASF. Aut-Min.",attivo:true},
  {chiave:"Codice ETA",valore:"ETA-12/0362",descrizione:"Codice ETA",attivo:true},
]};
export function loadSettings():SettingsData{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return defaultSettings;const value=JSON.parse(raw) as Partial<SettingsData>;return{operatori:value.operatori??[],rimorchi:value.rimorchi??[],trasportatori:value.trasportatori??[],listeOperative:value.listeOperative??defaultSettings.listeOperative};}catch(error){console.error("Impossibile leggere le impostazioni locali",error);return defaultSettings;}}
export function saveSettings(settings:SettingsData){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch(error){console.error("Impossibile salvare le impostazioni locali",error);}}
export const createRegistryId=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;
