import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
test('storage-only browser upload does not call the legacy classifier',async()=>{
 let saved=0,classified=0;
 const old=globalThis.fetch;
 globalThis.fetch=async()=>{classified++;return Response.json({topic:{topic:'legacy'}})};
 const env={PUBLIC_BASE_URL:'https://img.shdkej.com',MAX_WIDTH:'1600',OUTPUT_FORMAT:'image/webp',OUTPUT_QUALITY:'85',ARCHIVE_API_URL:'https://api.test/classify',ARCHIVE_PROXY_TOKEN:'test',BUCKET:{put:async()=>{saved++}},IMAGES:{input:()=>({transform(){return this},async output(){return{image:()=>new Uint8Array([1,2,3])}}})}};
 const form=new FormData();form.append('file',new Blob([new Uint8Array([1,2,3])],{type:'image/png'}),'test.png');
 try{const r=await worker.fetch(new Request('https://upload.shdkej.com/browser-store',{method:'POST',headers:{origin:'https://images.aws.shdkej.com'},body:form}),env);assert.equal(r.status,201);assert.equal(saved,1);assert.equal(classified,0);const d=await r.json();assert.ok(d.key.startsWith('original/'));}finally{globalThis.fetch=old}
});
test('storage-only upload rejects other origins',async()=>{const r=await worker.fetch(new Request('https://upload.shdkej.com/browser-store',{method:'POST',headers:{origin:'https://evil.test'}}),{});assert.equal(r.status,403)});
