import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadToArchive} from '../lib/archive-upload.ts';
const storage=()=>{const m=new Map<string,string>();return{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)}};
const file=()=>new File([new Uint8Array([1,2,3])],'example.webp',{type:'image/webp'});
test('completed duplicates never upload again',async()=>{const calls:string[]=[];const request:any=async(url:string)=>{calls.push(url);return Response.json({photo:{id:'existing'}})};const r=await uploadToArchive(file(),request,storage());assert.equal(r.duplicate,true);assert.equal(calls.length,1);});
test('a failed registration retries the stored image without uploading it again',async()=>{let uploads=0,registrations=0;const store=storage();const request:any=async(url:string)=>{if(url.includes('duplicates'))return Response.json({photo:null});if(url.includes('browser-store')){uploads++;return Response.json({key:'original/test.webp'})}registrations++;return registrations===1?Response.json({error:'offline'},{status:503}):Response.json({photo:{id:'stored'}})};await assert.rejects(()=>uploadToArchive(file(),request,store),/offline/);const r=await uploadToArchive(file(),request,store);assert.equal(r.photo.id,'stored');assert.equal(uploads,1);});
test('invalid files fail before any remote request',async()=>{let called=false;await assert.rejects(()=>uploadToArchive(new File(['x'],'raw.heic'),async()=>{called=true;return Response.json({})},storage()));assert.equal(called,false)});
