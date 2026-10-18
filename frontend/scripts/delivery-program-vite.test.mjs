import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer,resolveConfig} from 'vite';

test('PDF client: cache TEST separata, import e risorse HTTP validi anche dopo un test Vite SSR',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),configFile=join(root,'vite.config.ts');
 const liveConfig=await resolveConfig({root,configFile,mode:'test'},'serve');
 const ssrConfig=await resolveConfig({root,configFile:false},'serve');
 assert.notEqual(liveConfig.cacheDir,ssrConfig.cacheDir,'Interactive TEST and SSR helpers must never share optimized modules');
 assert.match(liveConfig.cacheDir,/\.vite-sislog-test$/);
 const dir=mkdtempSync(join(tmpdir(),'sislog-pdf-client-import-'));
 const browser=await createServer({root,configFile,mode:'test',cacheDir:join(dir,'browser'),server:{host:'127.0.0.1',port:0,strictPort:false,https:undefined,watch:null,ws:false},optimizeDeps:{include:['jspdf','jspdf-autotable']}});
 let ssr;
 try{
  await browser.listen();
  const address=browser.httpServer.address();assert.equal(typeof address,'object');
  const base=`http://127.0.0.1:${address.port}`;
  const get=async path=>{const response=await fetch(new URL(path,base));assert.equal(response.status,200,`${path}: ${response.status} ${response.statusText}`);return response;};
  const controller=await (await get('/src/components/shipments/DeliveryProgramExport.tsx')).text();
  assert.match(controller,/import\(["']\/src\/services\/deliveryProgramPdf\.ts/);
  const source=await (await get('/src/services/deliveryProgramPdf.ts')).text();
  const imports=[...source.matchAll(/from ["']([^"']+)["']/g)].map(match=>match[1]);
  const dependencies=imports.filter(path=>path.includes('jspdf'));
  assert.equal(dependencies.length,2);
  for(const path of dependencies)await get(path);
  const assets=imports.filter(path=>path.includes('?import&url'));assert.equal(assets.length,3);
  for(const path of assets){
   const wrapper=await (await get(path)).text();
   const url=wrapper.match(/export default ["']([^"']+)["']/)?.[1];assert.ok(url,path);
   assert((await (await get(url)).arrayBuffer()).byteLength>1000);
  }
  ssr=await createServer({root,configFile:false,cacheDir:join(dir,'ssr'),server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});
  await ssr.ssrLoadModule('/src/services/deliveryProgramPdf.ts');
  await ssr.close();ssr=undefined;
  // Reuse the browser's original versioned URLs; they must not become 504 Outdated Optimize Dep.
  for(const path of dependencies)await get(path);
 }finally{await ssr?.close();await browser.close();rmSync(dir,{recursive:true,force:true});}
});
