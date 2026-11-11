import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCategories, parseDecision, imageDimensions, safeFilename, exportPath } from '../lib/domain.ts';

test('분류 이름 중복과 빈 이름, 과도한 항목을 거절한다', () => {
  assert.throws(() => validateCategories(['자연', ' 자연 ']));
  assert.throws(() => validateCategories(['']));
  assert.throws(() => validateCategories(Array.from({length:25},(_,i)=>`c${i}`)));
  assert.deepEqual(validateCategories(['자연', '기타']), ['자연', '기타']);
});
test('제공사 확신도가 낮으면 검토 상태로 남기고 확률을 보존한다', () => {
  const result=parseDecision({model:'clef',answers:{category:{type:'choice',choice:'c0',confidence:0.4,probabilities:{c0:0.7,c1:0.3}}}}, ['자연','기타'],0.8);
  assert.equal(result.status,'review'); assert.equal(result.category,'자연'); assert.equal(result.confidence,0.4); assert.equal(result.probabilities['자연'],0.7);
});
test('알 수 없는 분류와 잘못된 숫자를 성공으로 처리하지 않는다',()=>{
  for(const answer of [{choice:'c8',confidence:0.9,probabilities:{c8:1}},{choice:'c0',confidence:NaN,probabilities:{c0:1,c1:0}},{choice:'c0',confidence:0.9,probabilities:{c0:2,c1:-1}},{choice:'c0',confidence:0.9,probabilities:{c0:0.1,c1:0.1}}]) {
    assert.throws(()=>parseDecision({model:'jev',answers:{category:{type:'choice',...answer}}},['자연','기타'],0.8));
  }
});
test('작은 사진과 파노라마는 비율 유지 후 패딩하여 Clef 규격을 만족한다',()=>{
  for(const [w,h] of [[10,10],[10000,100],[100,10000],[4000,3000]]) {
    const d=imageDimensions(w,h); assert.ok(d.width>=280&&d.height>=280&&d.width<=1568&&d.height<=1568); assert.ok(Math.abs(d.drawWidth/d.drawHeight-w/h)<0.02); assert.ok(d.drawWidth<=d.width&&d.drawHeight<=d.height);
  }
});
test('압축 경로 순회와 동일 파일명 충돌을 방지한다',()=>{
  assert.equal(safeFilename('../../a.jpg'),'a.jpg');
  assert.ok(!exportPath({id:'1234',name:'../a.jpg',category:'../자연',status:'done'}).split('/').includes('..'));
  assert.notEqual(exportPath({id:'a',name:'a.jpg',category:'자연',status:'done'}),exportPath({id:'b',name:'a.jpg',category:'자연',status:'done'}));
});
test('기존 분류 사진도 ZIP에서 해당 폴더에 들어간다',()=>{assert.ok(exportPath({id:'a',name:'x.webp',category:'자연',status:'existing'}).startsWith('자연/'));});
