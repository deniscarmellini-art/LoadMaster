import {apiRequest} from './apiClient';
import type {ApiSession} from './loadingApi';
export interface OfflineRow {line:number;raw:string;type:'PANEL'|'PACKAGE'|null;code:string;commessa:string;camion:string;elements:number;status:'VALID'|'DUPLICATE'|'ALREADY_LOADED'|'ERROR'|'LOADED';message:string}
export interface OfflineResult {rows:OfflineRow[];counts:{received:number;valid:number;packages:number;singles:number;elements:number;duplicates:number;errors:number;loaded:number;loadedElements:number};session?:ApiSession}
export const importOfflineQr=(id:string,text:string,operatorId:string,confirm=false)=>apiRequest<OfflineResult>(`/loading-sessions/${id}/offline/${confirm?'confirm':'preview'}`,{method:'POST',body:JSON.stringify({text,operatorId})});
