import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {webcrypto} from 'node:crypto';

for(const flag of [true,false,'true'])test(`DDT definitivo frontend: protezione TEST ${JSON.stringify(flag)}, doppio clic e ristampa archivio`,async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,define:{'import.meta.env.VITE_SISLOG_TEST':JSON.stringify(flag)},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 const original=globalThis.fetch;const calls=[];
 try{
  const api=await server.ssrLoadModule('/src/services/definitiveDdtApi.ts');
  const {default:Panel}=await server.ssrLoadModule('/src/components/shipments/DefinitiveDdtPanel.tsx');
  const html=renderToStaticMarkup(React.createElement(Panel,{sessionId:'S',operatorId:'OP',revision:'closed',onLocked:()=>{throw Error('render must not lock');}}));
  if(flag!==true){assert.equal(html,'');assert.throws(()=>api.issueDefinitiveDdt('S','OP','same-request-key'),/esclusivamente in TEST/);assert.throws(()=>api.originalDdtPdf('D'),/esclusivamente in TEST/);return;}
  assert(!html.includes('Emetti DDT definitivo'));assert(!html.includes('Annulla DDT'));
  const {createDdtRequestKey}=await server.ssrLoadModule('/src/services/ddtRequestKey.ts');
  const requestKey=createDdtRequestKey({getRandomValues:bytes=>webcrypto.getRandomValues(bytes)});
  let release;globalThis.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({id:'D',fullNumber:'X-Lam/0001/2026',status:'EMESSO'}),{headers:{'content-type':'application/json'}}));});};
  const first=api.issueDefinitiveDdt('S','OP',requestKey),second=api.issueDefinitiveDdt('S','OP',requestKey);
  assert.equal(calls.length,1);assert.equal(first,second);assert.equal(calls[0].url,'/api/loading-sessions/S/ddt');assert.deepEqual(JSON.parse(calls[0].options.body),{operatorId:'OP',requestKey});
  release();assert.equal((await first).id,'D');
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(new Uint8Array([37,80,68,70,45]),{headers:{'content-type':'application/pdf'}});};
  const pdf=await api.originalDdtPdf('D');assert.equal(pdf.size,5);assert.equal(calls[1].url,'/api/ddt/D/pdf');assert.equal(calls.some(call=>call.url.includes('preview')),false);
  const retried=[];globalThis.fetch=async(_url,options)=>{retried.push(JSON.parse(options.body));if(retried.length===1)throw new TypeError('risposta persa');return new Response(JSON.stringify({id:'SAME-DOCUMENT',status:'EMESSO'}),{headers:{'content-type':'application/json'}});};
  await assert.rejects(()=>api.issueDefinitiveDdt('S','OP','retry-original-key'));
  assert.equal((await api.issueDefinitiveDdt('S','OP','retry-original-key')).id,'SAME-DOCUMENT');assert.deepEqual(retried[0],retried[1]);
 }finally{globalThis.fetch=original;await server.close();}
});

test('annullamento DDT: motivazione/operatore, risposta persa e riconciliazione senza nuova emissione',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,define:{'import.meta.env.VITE_SISLOG_TEST':'true'},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 const original=globalThis.fetch;
 try{
  const api=await server.ssrLoadModule('/src/services/definitiveDdtApi.ts');
  for(const lostReply of [false,true]){
   const calls=[];
   const document={id:'OLD',status:'ANNULLATO',fullNumber:'X-Lam/0001/2026',cancellationReason:'Motivo originale',cancelledByOperatorId:'OP'};
   globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/cancel')){if(lostReply)throw new TypeError('risposta persa');return new Response(JSON.stringify(document),{headers:{'content-type':'application/json'}});}
    return new Response(JSON.stringify({document:null,history:[document],canIssue:true,canCancel:false,departed:false}),{headers:{'content-type':'application/json'}});
   };
   const latest=await api.cancelDdtAndRefresh('OLD','OP','Motivo originale','S');
   assert.equal(latest.history[0].status,'ANNULLATO');assert.equal(latest.canIssue,true);
   assert.deepEqual(JSON.parse(calls[0].options.body),{operatorId:'OP',reason:'Motivo originale'});
   assert.equal(calls[0].url,'/api/ddt/OLD/cancel');assert.equal(calls[1].url,'/api/loading-sessions/S/ddt');
   assert.equal(calls.length,2);assert(calls.every(call=>!call.url.includes('/ship')&&!call.url.includes('/depart')));
  }
  globalThis.fetch=async(url)=>url.endsWith('/cancel')?new Response(JSON.stringify({success:false,error:{code:'DDT_ALREADY_DEPARTED',message:'Operazione non consentita dopo la partenza.'}}),{status:409,headers:{'content-type':'application/json'}}):new Response(JSON.stringify({document:{id:'OLD',status:'EMESSO'},history:[{id:'OLD',status:'EMESSO'}],departed:true}),{headers:{'content-type':'application/json'}});
  await assert.rejects(()=>api.cancelDdtAndRefresh('OLD','OP','Motivo','S'),/dopo la partenza/);
 }finally{globalThis.fetch=original;await server.close();}
});
