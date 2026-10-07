import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('Carico camion: disponibili attivi, azione esplicita, assegnato unico e categorie senza rimorchio',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {default:Fields,availableLoadingTrailers}=await server.ssrLoadModule('/src/components/shipments/TruckLoadingTransportFields.tsx');
  const base={id:'T',plate:'AE 34133',description:'Centinato',active:true,status:'DISPONIBILE',assignmentId:null,canRelease:false};
  const items=[base,{...base,id:'inactive',active:false},{...base,id:'disabled',status:'FUORI_SERVIZIO'},{...base,id:'busy',status:'IMPEGNATO',assignmentId:'A'},{...base,id:'loaded',status:'CARICATO'},{...base,id:'travel',status:'IN_VIAGGIO'}];
  assert.deepEqual(availableLoadingTrailers(items).map(t=>t.id),['T']);
  let calls=0;
  const props={load:{id:'L',commessa:'265001',cliente:'Cliente',camion:'C1'},mode:'BILICO_ESSEPI',detailId:'',options:[],transports:items,saving:false,onRefresh:async()=>{calls++;},onBusyChange:()=>{},onModeChange:()=>{},onDetailChange:()=>{}};
  const render=(extra={})=>renderToStaticMarkup(React.createElement(Fields,{...props,...extra}));
  const empty=render();assert(empty.includes('Impegna rimorchio'));assert(empty.includes('Seleziona un rimorchio disponibile'));assert(empty.includes('Obbligatorio alla conclusione'));assert.equal(calls,0,'rendering/selecting does not issue any operation');
  const assigned={...base,status:'IMPEGNATO',assignmentId:'A',canRelease:true};
  const occupied=render({assigned});assert(occupied.includes('AE 34133'));assert(occupied.includes('Centinato'));assert(occupied.includes('Disimpegna'));assert(!occupied.includes('Impegna rimorchio'));
  assert(!render({assigned:{...assigned,canRelease:false}}).includes('>Disimpegna<'));
  for(const mode of ['RITIRA_CLIENTE','TERZI_PER_ESSEPI']){const markup=render({mode});assert(!markup.includes('Rimorchio Essepi'));assert(!markup.includes('Impegna rimorchio'));}
 }finally{await server.close();}
});
