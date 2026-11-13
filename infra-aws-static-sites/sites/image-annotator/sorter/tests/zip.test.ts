import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BlobReader,ZipReader} from '@zip.js/zip.js';
import {buildZip} from '../lib/export-zip.ts';
const p:any={id:'a',name:'test.webp',category:'문서',status:'existing'};
test('ZIP preserves category paths and produces a valid complete archive',async()=>{const blob=await buildZip([p],()=>{},async()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/webp'}}));const reader=new ZipReader(new BlobReader(blob));assert.deepEqual((await reader.getEntries()).map(e=>e.filename),['문서/a_test.webp']);await reader.close()});
test('ZIP fails explicitly instead of returning an archive missing images',async()=>{await assert.rejects(()=>buildZip([p],()=>{},async()=>new Response('',{status:502})),/다운로드에 실패/) });
