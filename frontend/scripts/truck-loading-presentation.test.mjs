import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ThemeProvider,createTheme} from '@mui/material/styles';
import {truckLoadingActionLabel,truckLoadingProgressMessage} from '../src/services/truckLoadingPresentation.ts';

const ready='Tutti gli elementi caricati \u2014 pronto per la chiusura';
const closed='Carico completato \u2014 in attesa della partenza';
test('messaggio: stato backend e conferma esplicita, non la sola percentuale o completedAt',()=>{
 assert.equal(truckLoadingProgressMessage('ATTESA_SPEDIZIONE',null,true),ready);
 assert.equal(truckLoadingProgressMessage('ATTESA_SPEDIZIONE',null,false),ready);
 assert.equal(truckLoadingProgressMessage('ATTESA_SPEDIZIONE','2026-10-17T09:00:00Z',true),closed);
 assert.equal(truckLoadingProgressMessage('ATTESA_SPEDIZIONE','2026-10-17T09:00:00Z',false),closed);
 assert.equal(truckLoadingProgressMessage('IN_CARICO',undefined,true),ready);
 assert.equal(truckLoadingProgressMessage('IN_CARICO','stale',false),null);
 assert.equal(truckLoadingProgressMessage('DA_CARICARE',undefined,true),null);
 assert.equal(truckLoadingProgressMessage('SPEDITO','timestamp',true),null);
});
test('azioni: mappa completa degli stati operativi',()=>{
 for(const [status,label] of Object.entries({DA_COMPLETARE:'Continua carico',DA_CARICARE:'Avvia carico',IN_CARICO:'Continua carico',ATTESA_SPEDIZIONE:'Visualizza carico'}))assert.equal(truckLoadingActionLabel(status),label);
});

test('Carico camion desktop e mobile: messaggi corretti, lista e consultazione senza controlli di modifica attivi',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {default:TruckLoading}=await server.ssrLoadModule('/src/pages/TruckLoading.tsx');
  const api=await server.ssrLoadModule('/src/services/loadingApi.ts');
  const waiting={id:'S',loadId:'L',commessa:'TEST',cliente:'Cliente',camion:'C1',transportMode:'RITIRA_CLIENTE',transportDetailId:null,transportDetailLabel:null,stato:'ATTESA_SPEDIZIONE',operatorId:'OP',destinationType:'TRASPORTATORE',trailerId:null,carrierId:null,startedAt:'2026-10-17T08:00:00Z',completedAt:'2026-10-17T09:00:00Z',shippedAt:null,units:[],events:[{type:'LOADING_COMPLETED',operatorId:'OP',timestamp:'2026-10-17T09:00:00Z',note:'Ricalcolo stato operativo'}]};
  const panel={backendId:'P',loadId:'L',numeroCamion:'C1',numeroPannello:'E1',numeroMasterPanel:'MP',peso:50,volume:.1,caricato:true,preparato:true,spedito:false};
  const row={id:'L',commessa:'TEST',cliente:'Cliente',camion:'C1',previsti:1,pronti:1,caricati:1,mancanti:0,peso:50,volume:.1,stato:'Attesa spedizione'};
  const props={onRefresh:async()=>{},shipments:[],clientVehicleTypes:[],thirdPartyTransportModes:[],rows:[row],commesse:[{ordine:'TEST',cliente:'Cliente',pannelli:[panel]}],singles:[{commessa:'TEST',camion:'C1',numeroPannello:'E1'}],packages:[],operators:[{id:'OP',attivo:true,nome:'Operatore'}],trailers:[],carriers:[],transports:[],loads:[],onResumeLoad:()=>{},onSessionChange:()=>{},onScanUnit:()=>{},onUndoUnit:()=>{},onComplete:()=>{}};
  for(const mobile of [false,true]){
   const theme=createTheme({components:{MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:()=>({matches:mobile})}}}});
   const render=extra=>renderToStaticMarkup(React.createElement(ThemeProvider,{theme},React.createElement(TruckLoading,{...props,...extra})));
   const pending=api.toLoad(waiting,()=> 'Operatore');
   const open=render({initialLoad:pending,loads:[pending],readOnly:false});
   assert.ok(open.includes(ready));assert.ok(!open.includes(closed));
   const confirmed=api.toLoad({...waiting,closureConfirmedAt:'2026-10-17T09:01:00Z',events:[...waiting.events,{type:'LOADING_CLOSURE_CONFIRMED',operatorId:'OP',timestamp:'2026-10-17T09:01:00Z',note:null}]},()=> 'Operatore');
   assert.equal(confirmed.chiusuraConfermataIl,'2026-10-17T09:01:00Z');assert.equal(confirmed.eventi.at(-1).tipo,'CHIUSURA');
   const viewed=render({initialLoad:confirmed,loads:[confirmed]});
   assert.ok(viewed.includes(closed));assert.ok(!viewed.includes(ready));assert.ok(viewed.includes('Consultazione carico'));assert.ok(!viewed.includes('modifiche in corso'));
   const buttons=viewed.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)||[];
   assert.match(buttons.find(b=>b.includes('Completa carico')),/disabled=""/);
   assert.match(buttons.find(b=>b.includes('UndoIcon')),/disabled=""/);
   assert.ok(viewed.includes('aria-disabled="true"'));
   const rows=['Da completare','Da caricare','In carico','Attesa spedizione'].map((stato,i)=>({...row,id:`L${i}`,commessa:`TEST-${i}`,stato}));
   const list=render({initialLoad:null,rows});
   assert.ok(list.includes(mobile?'Carichi disponibili':'Carichi da caricare o completare'));
   assert.equal((list.match(/>Avvia carico<\/button>/g)||[]).length,1);
   assert.equal((list.match(/>Continua carico<\/button>/g)||[]).length,2);
   assert.equal((list.match(/>Visualizza carico<\/button>/g)||[]).length,1);
  }
 }finally{await server.close();}
});
