import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPhotos,buildCsv,exportPhotos} from '../lib/library.ts';
import type {Photo} from '../lib/domain.ts';
const photo=(id:string,created:number,status='done')=>({id,name:'  =cmd',created,status,tags:'["a"]',original_key:'original/a.webp'} as Photo);
test('빈 스캔 페이지 뒤에도 이어 읽고 중복을 제거해 최신순으로 정렬한다',async()=>{
 const pages=[{photos:[photo('a',1)],cursor:'one'},{photos:[],cursor:'two'},{photos:[photo('a',1),photo('b',2)],cursor:null}];const urls:string[]=[];
 const result=await loadPhotos(async url=>{urls.push(url);return pages.shift()!});
 assert.deepEqual(result.map(p=>p.id),['b','a']);assert.ok(urls[2].includes('cursor=two'));
});
test('반복되는 커서는 무한 호출 대신 오류로 남긴다',async()=>{await assert.rejects(loadPhotos(async()=>({photos:[],cursor:'same'})));});
test('CSV는 한글 BOM과 수식 보호를 적용하고 대기 폴더만 내보낸다',()=>{
 const photos=exportPhotos([photo('a',1),photo('b',2,'pending')],'pending');assert.equal(photos.length,1);
 const csv=buildCsv(photos);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes("'  =cmd"));
});
