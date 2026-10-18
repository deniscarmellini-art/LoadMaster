import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { createDdtRequestKey } from '../src/services/ddtRequestKey.ts';

test('DDT request key: browser senza randomUUID usa CSPRNG e UUID v4 compatibile con API',()=>{
  let calls=0;
  const browser={getRandomValues(bytes){calls++;return webcrypto.getRandomValues(bytes);}};
  const keys=Array.from({length:1024},()=>createDdtRequestKey(browser));
  assert.equal(calls,1024);assert.equal(new Set(keys).size,1024);
  for(const key of keys)assert.match(key,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('DDT request key: API nativa preservata e assenza CSPRNG bloccata senza chiavi deboli',()=>{
  const expected='f2cb5390-dac5-4fc4-9527-1fc5d6eaa18e';
  assert.equal(createDdtRequestKey({randomUUID(){return expected;},getRandomValues(){throw Error('fallback inatteso');}}),expected);
  assert.throws(()=>createDdtRequestKey({}),/Generazione sicura/);
});

test('DDT request key: fallback disponibile nel contesto globale del browser',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try{
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:bytes=>webcrypto.getRandomValues(bytes)}});
    assert.match(createDdtRequestKey(),/^[a-f0-9-]{36}$/);
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
    assert.throws(()=>createDdtRequestKey(),/Generazione sicura/);
  }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto;}
});
