import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

test('conferma trasporto: evento dedicato, senza inventare partenza o alterare operatore e date storiche',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,define:{'import.meta.env.VITE_SISLOG_TEST':'true'},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {toLoad}=await server.ssrLoadModule('/src/services/loadingApi.ts');
  const session={id:'S',loadId:'L',commessa:'265484',cliente:'Wood Solution',camion:'C1-',stato:'ATTESA_SPEDIZIONE',operatorId:'ORIGINAL',destinationType:'RIMORCHIO_ESSEPI',trailerId:'TRAILER',carrierId:'CONFIRMED',transportMode:'BILICO_ESSEPI',transportDetailId:null,transportDetailLabel:'Vettore scelto',startedAt:'2026-09-15T09:48:26.861Z',completedAt:'2026-09-17T07:13:11.334Z',shippedAt:null,units:[],events:[{type:'LOADING_COMPLETED',operatorId:'ORIGINAL',timestamp:'2026-09-17T07:13:11.334Z',note:null},{type:'HISTORICAL_TRANSPORT_CONFIRMED',operatorId:'CONFIRMING',timestamp:'2026-10-20T13:00:00Z',note:'{"planningUsed":false}'}]};
  const original=JSON.stringify(session),load=toLoad(session,id=>id);
  assert.deepEqual(load.eventi.map(e=>e.tipo),['CHIUSURA','TRASPORTO_CONFERMATO']);
  assert.equal(load.operatoreId,'ORIGINAL');assert.equal(load.eventi[1].operatoreId,'CONFIRMING');
  assert.equal(load.completatoIl,session.completedAt);assert.equal(load.avviatoIl,session.startedAt);assert.equal(load.speditoIl,undefined);assert.equal(load.stato,'ATTESA_SPEDIZIONE');assert.equal(JSON.stringify(session),original);
 }finally{await server.close();}
});
