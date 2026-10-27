import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const modes=['BILICO_ESSEPI','RITIRA_CLIENTE','TERZI_PER_ESSEPI'];
const session=mode=>({id:'S',loadId:'L',commessa:'TEST',cliente:'Cliente',camion:'C1',transportMode:mode,transportDetailId:null,transportDetailLabel:null,stato:'ATTESA_SPEDIZIONE',operatorId:'OP',destinationType:mode==='BILICO_ESSEPI'?'RIMORCHIO_ESSEPI':'TRASPORTATORE',trailerId:mode==='BILICO_ESSEPI'?'T':null,carrierId:mode==='BILICO_ESSEPI'?'C':null,startedAt:'2026-10-17T08:00:00Z',completedAt:'2026-10-17T09:00:00Z',closureConfirmedAt:'2026-10-17T09:00:00Z',shippedAt:null,units:[],events:[{type:'LOADING_COMPLETED',operatorId:'OP',timestamp:'2026-10-17T09:00:00Z',note:null}]});

test('annullamento DDT non viene interpretato come evento di partenza',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {toLoad}=await server.ssrLoadModule('/src/services/loadingApi.ts');
  const value=toLoad({...session('RITIRA_CLIENTE'),events:[{type:'DDT_CANCELLED',operatorId:'OP',timestamp:'2026-10-18T09:00:00Z',note:'Correzione'}]},id=>id);
  assert.equal(value.stato,'ATTESA_SPEDIZIONE');assert.equal(value.speditoIl,undefined);
  assert.equal(value.eventi[0].tipo,'DDT_ANNULLATO');assert(!value.eventi.some(event=>event.tipo==='PARTENZA'));
 }finally{await server.close();}
});

test('completamento frontend: API e stato in attesa per tre modalita; partenza solo con chiamata distinta',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 const originalFetch=globalThis.fetch;
 try{
  const api=await server.ssrLoadModule('/src/services/loadingApi.ts');
  for(const mode of modes){
   const calls=[];const waiting=session(mode);
   globalThis.fetch=async(url,options)=>{
    calls.push({url,method:options.method});
    const result=String(url).endsWith('/ship')?{...waiting,stato:'SPEDITO',shippedAt:'2026-10-17T10:00:00Z'}:waiting;
    return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}});
   };
   const completed=api.toLoad(await api.completeLoadingApi('S'),()=> 'Operatore');
   assert.deepEqual(calls,[{url:'/api/loading-sessions/S/complete',method:'POST'}]);
   assert.equal(completed.stato,'ATTESA_SPEDIZIONE');assert.equal(completed.completatoIl,waiting.completedAt);
   assert.equal(completed.speditoIl,undefined);assert.equal(completed.backendLoadId,'L');
   assert.equal(completed.rimorchioId,mode==='BILICO_ESSEPI'?'T':undefined);
   assert.equal(completed.eventi.some(event=>event.tipo==='PARTENZA'),false);
   const departed=api.toLoad(await api.shipLoadingApi('S',undefined,'OP'),()=> 'Operatore');
   assert.equal(calls.length,2);assert.equal(calls[1].url,'/api/loading-sessions/S/ship');
   assert.equal(departed.stato,'SPEDITO');assert.equal(departed.speditoIl,'2026-10-17T10:00:00Z');
  }
  const {default:TruckLoading}=await server.ssrLoadModule('/src/pages/TruckLoading.tsx');
  for(const mode of modes){
   const initialLoad=api.toLoad(session(mode),()=> 'Operatore');
   const html=renderToStaticMarkup(React.createElement(TruckLoading,{onRefresh:async()=>{},shipments:[],clientVehicleTypes:[],thirdPartyTransportModes:[],rows:[{id:'L',commessa:'TEST',cliente:'Cliente',camion:'C1',previsti:1,pronti:1,caricati:1,mancanti:0,peso:50,volume:.1,stato:'Attesa spedizione'}],commesse:[],singles:[],packages:[],operators:[{id:'OP',attivo:true,nome:'Operatore'}],trailers:[],carriers:[],transports:[],loads:[initialLoad],initialLoad,onResumeLoad:()=>{},onSessionChange:()=>{},onScanUnit:()=>{},onUndoUnit:()=>{},onComplete:()=>{}}));
   assert.ok(!html.includes('Completa carico'));assert.ok(html.includes('in attesa della partenza'));
   assert.ok(!html.includes('Conferma partenza'));assert.ok(!html.includes('Chiudi carico su rimorchio'));
  }
 }finally{globalThis.fetch=originalFetch;await server.close();}
});
