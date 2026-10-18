import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {panelQrText,packageQrText,parsePanelQr,parsePackageQr} from '../src/utils/panelQr.ts';

test('formati QR condivisi con le etichette reali: elemento e pacco',()=>{
 const panel={commessa:'TEST',cliente:'Cliente Test',numeroPannello:'001',camion:'C1',spessore:140,lunghezza:4000,altezza:2000,peso:560};
 const raw=panelQrText(panel);assert.equal(raw,'C=TEST|CL=Cliente Test|N=001|CA=C1|S=140|L=4000|H=2000|P=560');assert.deepEqual(parsePanelQr(raw),panel);
 const pack=packageQrText('PK-TEST','TEST','Cliente Test','C1',2,1120,2.24);
 assert.equal(pack,'PK=PK-TEST|C=TEST|CL=Cliente Test|CA=C1|PZ=2|KG=1120.0|MC=2.240');assert.equal(parsePackageQr(pack).numeroPannelli,2);
});

for(const flag of [true,false,'true'])test(`simulatore frontend: flag TEST ${JSON.stringify(flag)}, pulsante e servizio protetti`,async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,define:{'import.meta.env.VITE_SISLOG_TEST':JSON.stringify(flag)},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 const originalFetch=globalThis.fetch;let calls=0;
 try{
  const api=await server.ssrLoadModule('/src/services/loadingSimulationApi.ts');
  const {default:Simulator}=await server.ssrLoadModule('/src/components/shipments/TestScanSimulator.tsx');
  const html=renderToStaticMarkup(React.createElement(Simulator,{sessionId:'S',enabled:true,onScan:async()=>{throw Error('rendering must not scan');},result:null}));
  const candidate={id:'E1',type:'PANEL',code:'E1',elements:1,qr:'existing label'};
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/api/loading-sessions/S/test-qr-candidates');assert.ok(!options.method||options.method==='GET');return new Response(JSON.stringify([candidate]),{status:200,headers:{'content-type':'application/json'}});};
  if(flag===true){
   assert.ok(html.includes('Simula scansione'));assert.ok(html.includes('TEST'));
   assert.deepEqual(await api.listSimulationCandidates('S'),[candidate]);assert.equal(calls,1);
   const disabled=renderToStaticMarkup(React.createElement(Simulator,{sessionId:'S',enabled:false,onScan:async()=>{},result:null}));assert.ok(disabled.includes('disabled=""'));
  }else{
   assert.equal(html,'');await assert.rejects(()=>api.listSimulationCandidates('S'),/esclusivamente in TEST/);assert.equal(calls,0);
  }
 }finally{globalThis.fetch=originalFetch;await server.close();}
});
