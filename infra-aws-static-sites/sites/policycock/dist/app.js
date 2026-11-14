'use strict';
const STORAGE_KEY='modu-policy-map-v1';
const $=s=>document.querySelector(s);
let selectedId='lee', saved={}, storageAvailable=true, toastTimer;
const safeIds=new Set(POLICY_DATA.map(p=>p.id));
function readSaved(){
  const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'), result={};
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){
    for(const [id,v] of Object.entries(parsed)) if(safeIds.has(id)&&v&&typeof v==='object') result[id]={note:typeof v.note==='string'?v.note.slice(0,240):''};
  }
  return result;
}
try{saved=readSaved();}catch{storageAvailable=false;}
function notify(message){const node=$('#toast');node.textContent=message;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3200);}
function persist(next){
  try{
    let latest;
    try{latest=readSaved();}catch(error){if(error instanceof SyntaxError)latest={};else throw error;}
    // Apply only this tab's changes to the most recent browser state.
    for(const id of new Set([...Object.keys(saved),...Object.keys(next)])){
      if(!next[id])delete latest[id];
      else if(JSON.stringify(next[id])!==JSON.stringify(saved[id]))latest[id]=next[id];
    }
    localStorage.setItem(STORAGE_KEY,JSON.stringify(latest));
    storageAvailable=true;saved=latest;updateStorageNote();return true;
  }catch{storageAvailable=false;updateStorageNote();notify('이 브라우저에서는 저장할 수 없어요. 저장 권한을 확인해주세요.');return false;}
}
function updateStorageNote(){const n=$('#storage-note');n.textContent=storageAvailable?'저장 내용은 이 브라우저에만 남습니다. 브라우저 데이터를 지우면 함께 삭제됩니다.':'브라우저 저장 내용을 읽거나 저장하지 못했어요. 정책 탐색은 계속할 수 있습니다.';}
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function outLink(text,url){const a=el('a','',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function renderPeople(){for(const group of ['democratic','conservative']){const container=$('#'+group+'-list');container.replaceChildren();for(const p of POLICY_DATA.filter(p=>p.group===group)){const button=el('button','person');button.type='button';button.dataset.policy=p.id;button.setAttribute('aria-pressed',String(p.id===selectedId));button.setAttribute('aria-controls','policy-detail');button.setAttribute('aria-label',`${p.name} · ${p.policy} 정책 보기`);const avatar=el('span','avatar',p.name.slice(1));avatar.setAttribute('aria-hidden','true');if(p.photo){const img=el('img');img.alt='';img.src=p.photo;img.addEventListener('error',()=>img.remove());avatar.append(img);}const copy=el('span','person-copy');copy.append(el('span','person-name',p.name),el('span','person-policy',p.policy));button.append(avatar,copy,el('span','person-arrow','↗'));if(saved[p.id]){const mark=el('span','saved-indicator');mark.setAttribute('aria-label','내 지도에 저장됨');button.append(mark);}button.addEventListener('click',()=>selectPolicy(p.id,true));container.append(button);}}}
function selectPolicy(id,announce=false){const p=POLICY_DATA.find(p=>p.id===id);if(!p)return;selectedId=id;document.querySelectorAll('.person').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.policy===id)));const person=$('#detail-person');person.replaceChildren(document.createTextNode(p.name),el('span','',p.party));$('#detail-meta').textContent=`${p.year} · ${p.stage} / ${p.region}`;$('#detail-title').textContent=p.policy;$('#detail-summary').textContent=p.summary;$('#detail-links').replaceChildren(outLink(p.sourceLabel+' ↗',p.source),outLink('관련 뉴스 ↗',p.news),outLink('관련 법령 검색 ↗','https://www.law.go.kr/LSW/unSc.do?query='+encodeURIComponent(p.law)));$('#source-note').textContent='발표 당시 내용입니다. 현재 제도는 원문에서 확인하세요.'+(p.sourceNote?' '+p.sourceNote:'');const btn=$('#save-policy');btn.textContent=saved[id]?'내 지도에서 빼기 −':'내 지도에 저장 +';btn.setAttribute('aria-pressed',String(!!saved[id]));if(announce)notify(`${p.name} · ${p.policy} — 지도 아래에서 내용을 확인하세요.`);}
$('#save-policy').addEventListener('click',()=>{const id=selectedId,next={...saved},wasSaved=!!next[id];if(wasSaved)delete next[id];else next[id]={note:''};if(persist(next)){renderSaved();renderPeople();selectPolicy(id);notify(wasSaved?'내 지도에서 뺐어요.':'내 지도에 담았어요. 관심 이유도 남겨보세요.');}});
function renderSaved(){const items=POLICY_DATA.filter(p=>saved[p.id]);$('#saved-count').textContent=items.length;$('#export-map').disabled=!items.length;const categories=new Map();items.forEach(p=>categories.set(p.category,(categories.get(p.category)||0)+1));const cats=$('#category-map');cats.replaceChildren();for(const [name,count] of categories){const chip=el('div','category-chip',name);chip.append(el('span','',String(count)));cats.append(chip);}const list=$('#saved-policies');list.replaceChildren();if(!items.length){const empty=el('div','empty-map');empty.append(el('span','empty-icon','⌖'),el('h3','','나에게 중요한 정책 하나부터.'),el('p','','위 지도에서 정책을 고르고 저장해보세요.\n선택한 정책이 여기에 모입니다.'));const a=el('a','','정책 지도에서 시작하기 ↑');a.href='#atlas';empty.append(a);list.append(empty);return;}for(const p of items){const row=el('article','saved-row');const title=el('div');const link=el('a','saved-policy-name',p.policy);link.href='#policy-detail';link.addEventListener('click',()=>selectPolicy(p.id));title.append(link,el('span','saved-policy-meta',`${p.name} · ${p.category}`));const field=el('div','note-field');const label=el('label','','다시 보고 싶은 이유');label.htmlFor='note-'+p.id;const input=el('textarea');input.id='note-'+p.id;input.maxLength=240;input.rows=2;input.placeholder='예: 출퇴근 교통비와 연결되는 정책이에요.';input.value=saved[p.id].note;input.addEventListener('input',()=>persist({...saved,[p.id]:{note:input.value.slice(0,240)}}));input.addEventListener('change',()=>{if(storageAvailable)notify('관심 이유를 저장했어요.');});field.append(label,input);const remove=el('button','remove-btn','삭제');remove.type='button';remove.setAttribute('aria-label',p.policy+' 저장 삭제');remove.addEventListener('click',()=>{const next={...saved};delete next[p.id];if(persist(next)){renderSaved();renderPeople();selectPolicy(selectedId);notify('내 지도에서 뺐어요.');$('#my-map-title').setAttribute('tabindex','-1');$('#my-map-title').focus({preventScroll:true});}});row.append(title,field,remove);list.append(row);}}
for(const filter of document.querySelectorAll('[data-filter]'))filter.addEventListener('click',()=>{const group=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>{const active=n===filter;n.classList.toggle('active',active);n.setAttribute('aria-pressed',String(active));});for(const name of ['democratic','conservative'])$('.'+name+'-column').classList.toggle('is-dimmed',group!=='all'&&group!==name);if(group!=='all'&&POLICY_DATA.find(p=>p.id===selectedId).group!==group)selectPolicy(POLICY_DATA.find(p=>p.group===group).id);});
$('#export-map').addEventListener('click',()=>{const data={title:'모두의정책 · 내 활성 지도',exportedAt:new Date().toISOString(),policies:POLICY_DATA.filter(p=>saved[p.id]).map(p=>({id:p.id,name:p.name,policy:p.policy,year:p.year,source:p.source,note:saved[p.id].note}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='나의-정책지도.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('내 정책 지도를 파일로 내보냈어요.');});
const ns='http://www.w3.org/2000/svg';
const labelOffsets={'서울':[12,-9],'인천':[-36,5],'경기':[12,16],'강원':[12,-7],'충북':[10,-5],'충남':[-35,-9],'대전':[13,20],'세종':[-34,0],'전북':[12,15],'광주':[-37,0],'전남':[-32,18],'경북':[12,-5],'대구':[12,8],'울산':[12,2],'경남':[-40,12],'부산':[12,16],'제주':[13,4]};
for(const [name,lng,lat,url] of COUNCILS){const officialName=name==='국회'?'대한민국 국회':name+' 광역의회';$('#council-links').append(outLink(name==='국회'?'국회':name,url));if(name==='국회')continue;const x=100+(lng-125)*102,y=55+(38.8-lat)*98;const a=document.createElementNS(ns,'a');a.setAttribute('href',url);a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer');a.setAttribute('class','council-pin');a.setAttribute('aria-label',officialName+' 공식 사이트');const hit=document.createElementNS(ns,'circle');hit.setAttribute('cx',x);hit.setAttribute('cy',y);hit.setAttribute('r','15');hit.style.fill='transparent';hit.style.stroke='none';const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','4');const label=document.createElementNS(ns,'text');const offset=labelOffsets[name];label.setAttribute('x',x+offset[0]);label.setAttribute('y',y+offset[1]);label.textContent=name;a.append(hit,circle,label);$('#council-pins').append(a);}
renderPeople();renderSaved();selectPolicy(selectedId);updateStorageNote();

window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY&&event.key!==null)return;
  const focused=document.activeElement;
  const caret=focused?.tagName==='TEXTAREA'?{id:focused.id,start:focused.selectionStart,end:focused.selectionEnd}:null;
  try{saved=readSaved();storageAvailable=true;}catch{storageAvailable=false;}
  renderSaved();renderPeople();selectPolicy(selectedId);updateStorageNote();
  if(caret){const input=document.getElementById(caret.id);if(input){input.focus({preventScroll:true});input.setSelectionRange(caret.start,caret.end);}}
});
