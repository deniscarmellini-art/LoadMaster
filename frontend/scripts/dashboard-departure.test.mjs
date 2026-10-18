import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MenuList} from '@mui/material';
import {runDashboardPrimaryAction,dashboardPrimaryLabel} from '../src/components/dashboard/dashboardPrimaryAction.ts';
import {dashboardLoadForRow} from '../src/services/departureConfirmation.ts';

test('azione primaria desktop/mobile in attesa visualizza il carico, senza aprire la partenza',()=>{
 const calls=[];const handlers=Object.fromEntries(['onViewLoad','onConfirmDeparture','onContinueLoad','onOpenHistory','onOpenScanning','onStartLoad'].map(name=>[name,()=>calls.push(name)]));
 const row={id:'L',stato:'Attesa spedizione'};
 runDashboardPrimaryAction(row,handlers);assert.deepEqual(calls,['onViewLoad']);assert.equal(dashboardPrimaryLabel(row),'Visualizza carico');
 for(const [stato,handler] of [['Da completare','onOpenScanning'],['Da caricare','onStartLoad'],['In carico','onContinueLoad'],['Partita','onOpenHistory']]){calls.length=0;runDashboardPrimaryAction({...row,stato},handlers);assert.deepEqual(calls,[handler]);}
});
test('selezione Dashboard: soltanto ID del carico, spedizioni multiple e ambiguita',()=>{
 const first={loadId:'S1',backendLoadId:'L1',commessa:'TEST',camion:'C1'};const second={...first,loadId:'S2',backendLoadId:'L2'};
 assert.equal(dashboardLoadForRow({id:'L1'},[second,first]),first);assert.equal(dashboardLoadForRow({id:'L2'},[first,second]),second);
 assert.equal(dashboardLoadForRow({id:'missing'},[first,second]),undefined);
 assert.equal(dashboardLoadForRow({id:'L1'},[first,{...first,loadId:'duplicate'}]),undefined);
});
test('partenza: nessuna importazione dei servizi di partenza nelle altre schermate operative',()=>{
 for(const page of ['Shipments','TruckLoading','Transports']){
  const source=readFileSync(new URL(`../src/pages/${page}.tsx`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bdepartShipment\b|\bshipLoadingApi\b/);assert.doesNotMatch(source,/>Conferma partenza</);
 }
});
test('menu Operazioni: tre azioni, DDT definitivo obbligatorio e identita della conferma per tutte le modalita',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {DashboardWaitingActionsList:Actions}=await server.ssrLoadModule('/src/components/dashboard/DashboardWaitingActions.tsx');
  const {default:Identity}=await server.ssrLoadModule('/src/components/dashboard/DashboardDepartureIdentity.tsx');
  const calls=[],props={sessionId:'S',onViewLoad:()=>calls.push('view'),onViewDdt:()=>calls.push('ddt'),onConfirmDeparture:()=>calls.push('confirm')};
  for(const available of [false,true]){
   const tree=Actions({...props,available,canDepart:available,reason:available?'':'DDT non disponibile'});
   const html=renderToStaticMarkup(React.createElement(MenuList,null,tree));assert.ok(html.includes('Visualizza carico'));assert.ok(html.includes('Visualizza / Stampa DDT'));assert.ok(html.includes('Conferma partenza'));
   const items=tree.props.children;
   assert.equal(items[1].props.disabled,!available);assert.equal(items[2].props.disabled,false);
   calls.length=0;items[0].props.onClick();assert.deepEqual(calls,['view']);
   calls.length=0;items[2].props.onClick();assert.deepEqual(calls,['confirm']);
  }
  for(const mode of ['BILICO_ESSEPI','RITIRA_CLIENTE','TERZI_PER_ESSEPI']){
   const html=renderToStaticMarkup(React.createElement(Identity,{row:{id:'L',cliente:'Cliente reale',commessa:'COMM-123',camion:'C7'},mode}));
   assert.ok(html.includes({BILICO_ESSEPI:'Bilico Essepi',RITIRA_CLIENTE:'Ritira Cliente',TERZI_PER_ESSEPI:'Terzi per Essepi'}[mode]));
   for(const value of ['Cliente reale','COMM-123','C7','Commessa','Cliente','Camion','readOnly'])assert.ok(html.includes(value)||html.includes(value.toLowerCase()));
  }
 }finally{await server.close();}
});

test('badge Attesa spedizione desktop/mobile: apre la stessa conferma del menu e interrompe il clic sulla riga',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
 try{
  const {default:Badge}=await server.ssrLoadModule('/src/components/dashboard/DashboardStatusBadge.tsx');
  const {DashboardWaitingActionsList:Actions}=await server.ssrLoadModule('/src/components/dashboard/DashboardWaitingActions.tsx');
  const calls=[],row={id:'L',stato:'Attesa spedizione',commessa:'TEST',camion:'C1'};
  const open=selected=>calls.push(['open-confirmation',selected.id]);
  for(const mobile of [false,true])for(const documentStatus of ['EMESSO',null,'ANNULLATO']){
   calls.length=0;
   const badge=Badge({row,mobile,onConfirmDeparture:open});
   const menu=Actions({sessionId:'S',available:true,reason:'',canDepart:documentStatus==='EMESSO',onViewLoad:()=>calls.push('load'),onViewDdt:()=>calls.push('ddt'),onConfirmDeparture:()=>open(row)});
   assert.deepEqual(calls,[],'Rendering either entry point must never confirm departure');
   assert.equal(badge.props.clickable,true);
   let stopped=false;badge.props.onClick({stopPropagation:()=>{stopped=true;}});
   assert.equal(stopped,true);assert.deepEqual(calls,[['open-confirmation','L']]);
   calls.length=0;menu.props.children[2].props.onClick();assert.deepEqual(calls,[['open-confirmation','L']]);
   stopped=false;badge.props.onDoubleClick({stopPropagation:()=>{stopped=true;}});assert.equal(stopped,true);
   const html=renderToStaticMarkup(badge);assert.match(html,/role="button"/);assert.match(html,/tabindex="0"/);
   if(documentStatus!=='EMESSO')assert.match(renderToStaticMarkup(React.createElement(MenuList,null,menu)),/Un DDT annullato non consente la partenza/);
  }
  for(const stato of ['Da completare','Da caricare','In carico','Partita']){
   const badge=Badge({row:{...row,stato},onConfirmDeparture:open});
   assert.equal(badge.props.onClick,undefined);assert.equal(badge.props.clickable,undefined);
  }
  // Both entry points use the existing guarded dialog; neither owns a departure API.
  const dashboard=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8');
  assert.equal((dashboard.match(/<DialogTitle>Conferma partenza<\/DialogTitle>/g)??[]).length,1);
  assert.match(dashboard,/disabled=\{!departureDdtValid \|\| isDeparting/);
  assert.match(dashboard,/if \(!departureDdtValid \|\| !departureRow/);
  assert.match(dashboard,/Apri carico \/ DDT/);
 }finally{await server.close();}
});
