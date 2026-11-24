'use strict';
// Safari can paint page content below its reported viewport behind the floating toolbar.
const landingBackdrop=document.querySelector('.landing-backdrop');
if(landingBackdrop){
  let layoutWidth,screenHeight;
  function updateLandingSize(){
    const width=document.documentElement.clientWidth;
    if(width===layoutWidth && screen.height===screenHeight)return;
    layoutWidth=width;
    screenHeight=screen.height;
    landingBackdrop.style.setProperty('--screen-height',screenHeight+'px');
    // Keep the original small viewport while the browser chrome expands or collapses.
    const smallHeight=parseFloat(getComputedStyle(landingBackdrop).minHeight);
    if(smallHeight>0)landingBackdrop.style.setProperty('--content-height',smallHeight+'px');
  }
  updateLandingSize();
  window.addEventListener('resize',updateLandingSize);
}
const printStateMap=document.getElementById('print-state-map');
printStateMap.hidden=false;
printStateMap.addEventListener('click',()=>window.print());

const stateDialog=document.querySelector('#state-policy-dialog');
for(const node of document.querySelectorAll('.state-node')){
  node.setAttribute('aria-haspopup','dialog');
  node.setAttribute('aria-controls',stateDialog.id);
  node.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const source=document.getElementById(node.hash.slice(1));
    if(!source)return;
    event.preventDefault();
    const body=stateDialog.querySelector('.state-dialog-body');
    body.replaceChildren(...Array.from(source.children).filter(n=>!n.matches('.state-return')).map(n=>n.cloneNode(true)));
    body.querySelector('h3').id='state-dialog-title';
    stateDialog.showModal();
    stateDialog.scrollTop=0;
    stateDialog.querySelector('.dialog-close').focus();
    stateDialog.addEventListener('close',()=>node.focus({preventScroll:true}),{once:true});
  });
}
stateDialog.querySelector('.dialog-close').addEventListener('click',()=>stateDialog.close());
stateDialog.addEventListener('click',event=>{if(event.target===stateDialog)stateDialog.close();});

// Keep the server-rendered source links if the policy registry fails to load.
if(typeof POLICY_DATA!=='undefined'){
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
function policyTimeline(id){
  return typeof POLICY_TIMELINES==='undefined'?[]:POLICY_TIMELINES[id]||[];
}

function portrait(id){
  const image=el('img','policy-portrait');
  image.src='assets/portraits/'+id+'.jpg';
  image.width=32;image.height=32;image.alt='';
  return image;
}
function renderPeople(){
  for(const group of ['democratic','conservative']){
    const container=$('#'+group+'-list');container.replaceChildren();
    for(const p of POLICY_DATA.filter(p=>p.group===group)){
      const button=el('button','person');button.type='button';button.dataset.policy=p.id;
      const activeFilter=document.querySelector('[data-filter].active')?.dataset.filter||'all';
      if(activeFilter!=='all'&&activeFilter!==group)button.classList.add('is-dimmed');
      button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','policy-dialog');
      button.setAttribute('aria-label',`${p.name} / ${p.policy} 정책 보기`);
      const lead=el('span','lead-mark');lead.setAttribute('aria-hidden','true');
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 80 55');svg.setAttribute('focusable','false');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M7 8 62 38');
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('cx','7');dot.setAttribute('cy','8');dot.setAttribute('r','4');
      svg.append(path,dot);lead.append(svg);
      const name=el('span','person-name');name.append(portrait(p.id),p.name);
      const copy=el('span','person-copy');copy.append(name,el('span','person-policy',p.policy),el('span','person-stage',`${p.year} / ${p.stage}`));
      const events=policyTimeline(p.id);
      if(events.length){
        const track=el('span','case-dots');
        track.setAttribute('aria-hidden','true');
        events.forEach(()=>track.append(el('i','case-dot')));
        track.append(el('span','case-card-count','추적 '+events.length+'건'));
        copy.append(track);
        button.setAttribute('aria-label',p.name+' / '+p.policy+ ' 정책 보기, 추적 '+events.length+'건');
      }
      button.append(lead,copy);
      if(saved[p.id]){const mark=el('span','saved-indicator');mark.setAttribute('aria-label','내 지도에 저장됨');button.append(mark);}
      button.addEventListener('click',()=>openPolicy(p.id,button));container.append(button);
    }
  }
}
function selectPolicy(id){const p=POLICY_DATA.find(p=>p.id===id);if(!p)return;selectedId=id;const person=$('#detail-person');person.replaceChildren(portrait(id),document.createTextNode(p.name),el('span','',p.party));$('#detail-meta').textContent=`${p.year} / ${p.stage} / ${p.region}`;$('#detail-title').textContent=p.policy;$('#detail-summary').textContent=p.summary;$('#detail-links').replaceChildren(outLink(p.sourceLabel+' ↗',p.source),outLink('관련 뉴스 ↗',p.news),outLink('관련 법령 검색 ↗','https://www.law.go.kr/LSW/unSc.do?query='+encodeURIComponent(p.law)));$('#source-note').textContent='위 링크는 발표 당시 자료입니다.'+(p.sourceNote?' '+p.sourceNote:'');const btn=$('#save-policy');btn.textContent=saved[id]?'내 지도에서 빼기 −':'내 지도에 저장 +';btn.setAttribute('aria-pressed',String(!!saved[id]));}
const policyDialog=$('#policy-dialog');
let dialogOpener=null,dialogPolicyId=null;
const timelineList=$('#timeline-events');
const timelinePrev=$('#timeline-prev');
const timelineNext=$('#timeline-next');

function renderTimeline(id){
  const events=policyTimeline(id);
  const overview=$('#change-overview');
  const latestIndex=events.findLastIndex(event=>!event.scheduled);
  const latest=events[latestIndex];
  overview.hidden=!latest;
  const difference=$('#change-difference');
  difference.textContent=latest?.changeSinceFirst||'';
  difference.hidden=!difference.textContent;
  if(latest){
    for(const [name,event] of [['first',events[0]],['latest',latest]]){
      $('#change-'+name+'-date').textContent=event.date.replaceAll('-','.').replace(' 기준','');
      $('#change-'+name).textContent=event.summary||event.label;
    }
  }
  timelineList.closest('section').hidden=events.length===0;
  const stars=events.map((event,index)=>{
    const item=el('li','timeline-event');
    const star=el('button','timeline-star');
    const date=event.date.replaceAll('-','.');
    star.append(el('span','timeline-date',event.scheduled?date+' · 예정':date),
      el('span','timeline-title',event.title||event.label));
    star.type='button';
    star.setAttribute('aria-controls','event-label');
    star.addEventListener('click',()=>selectEvent(index));
    item.append(star);
    return item;
  });
  timelineList.replaceChildren(...stars);
  let selected=Math.max(0,latestIndex);
  function selectEvent(index){
    const event=events[index];
    if(!event)return;
    selected=index;
    for(const [i,item] of stars.entries()){
      item.firstChild.setAttribute('aria-pressed',String(i===index));
    }
    const star=stars[index];
    // Keep the date visible without scrolling the surrounding modal.
    const centered=star.offsetLeft+(star.offsetWidth-timelineList.clientWidth)/2;
    const upcoming=events[index+1]?.scheduled && stars[index+1];
    timelineList.scrollLeft=upcoming
      ? Math.max(centered,upcoming.offsetLeft+upcoming.offsetWidth-timelineList.clientWidth)
      : centered;
    timelinePrev.disabled=index===0;
    timelineNext.disabled=index===events.length-1;
    $('#event-kind').textContent=event.scheduled?(event.scheduleKind||'시행 확정'):index===latestIndex?'최근 기록':index===0?'최초 기록':'변경 기록';
    $('#event-date').textContent=event.date.replaceAll('-','.');
    $('#event-label').textContent=event.label;
    $('#event-source').href=event.url;
  }
  timelinePrev.onclick=()=>selectEvent(selected-1);
  timelineNext.onclick=()=>selectEvent(selected+1);
  selectEvent(selected);
}

function openPolicy(id,trigger){
  selectPolicy(id);
  dialogOpener=trigger;
  dialogPolicyId=id;
  document.getElementById('policy-record-link').href='/policies/'+id+'.html';
  policyDialog.showModal();
  renderTimeline(id);
  window.policycockCapture?.("case_opened");
  policyDialog.scrollTop=0;
  policyDialog.querySelector('.dialog-close').focus();
}
{const dialog=policyDialog;dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{let target=dialogOpener;if(dialogPolicyId&&(!target||!target.isConnected))target=document.querySelector(`.person[data-policy="${dialogPolicyId}"]`);if(target?.isConnected)target.focus({preventScroll:true});dialogOpener=null;dialogPolicyId=null;});}
function toggleSavedPolicy(id){const next={...saved},wasSaved=!!next[id];if(wasSaved)delete next[id];else next[id]={note:''};if(persist(next)){renderSaved();renderPeople();selectPolicy(id);notify(wasSaved?'내 지도에서 뺐어요.':'내 지도에 담았어요. 관심 이유도 남겨보세요.');}}
$('#save-policy').addEventListener('click',()=>toggleSavedPolicy(selectedId));
function renderSaved(){const items=POLICY_DATA.filter(p=>saved[p.id]);$('#saved-count').textContent=items.length;$('#export-map').disabled=!items.length;const categories=new Map();items.forEach(p=>categories.set(p.category,(categories.get(p.category)||0)+1));const cats=$('#category-map');cats.replaceChildren();for(const [name,count] of categories){const chip=el('div','category-chip',name);chip.append(el('span','',String(count)));cats.append(chip);}const list=$('#saved-policies');list.replaceChildren();if(!items.length){const empty=el('div','empty-map');empty.append(el('span','empty-icon','⌖'),el('h3','','나에게 중요한 정책 하나부터.'),el('p','','위 사례에서 정책을 고르고 저장해보세요.\n선택한 정책이 여기에 모입니다.'));const a=el('a','','정책 사례에서 시작하기 ↑');a.href='#policies';empty.append(a);list.append(empty);return;}for(const p of items){const row=el('article','saved-row');const title=el('div');const link=el('a','saved-policy-name',p.policy);link.href='#policies';link.addEventListener('click',event=>{event.preventDefault();openPolicy(p.id,link);});title.append(link,el('span','saved-policy-meta',`${p.name} / ${p.category}`));const field=el('div','note-field');const label=el('label','','다시 보고 싶은 이유');label.htmlFor='note-'+p.id;const input=el('textarea');input.id='note-'+p.id;input.maxLength=240;input.rows=2;input.placeholder='예: 출퇴근 교통비와 연결되는 정책이에요.';input.value=saved[p.id].note;input.addEventListener('input',()=>persist({...saved,[p.id]:{note:input.value.slice(0,240)}}));input.addEventListener('change',()=>{if(storageAvailable)notify('관심 이유를 저장했어요.');});field.append(label,input);const remove=el('button','remove-btn','삭제');remove.type='button';remove.setAttribute('aria-label',p.policy+' 저장 삭제');remove.addEventListener('click',()=>{const next={...saved};delete next[p.id];if(persist(next)){renderSaved();renderPeople();selectPolicy(selectedId);notify('내 지도에서 뺐어요.');$('#my-map-title').setAttribute('tabindex','-1');$('#my-map-title').focus({preventScroll:true});}});row.append(title,field,remove);list.append(row);}}
for(const filter of document.querySelectorAll('[data-filter]'))filter.addEventListener('click',()=>{const group=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>{const active=n===filter;n.classList.toggle('active',active);n.setAttribute('aria-pressed',String(active));});for(const name of ['democratic','conservative']){const dimmed=group!=='all'&&group!==name;$('.'+name+'-column').classList.toggle('is-dimmed',dimmed);document.querySelectorAll('.'+name+'-column .person').forEach(n=>n.classList.toggle('is-dimmed',dimmed));}if(group!=='all'&&POLICY_DATA.find(p=>p.id===selectedId).group!==group)selectPolicy(POLICY_DATA.find(p=>p.group===group).id);});
$('#export-map').addEventListener('click',()=>{const data={title:'모두의정책 / 내 활성 지도',exportedAt:new Date().toISOString(),policies:POLICY_DATA.filter(p=>saved[p.id]).map(p=>({id:p.id,name:p.name,policy:p.policy,year:p.year,source:p.source,note:saved[p.id].note}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='나의-정책지도.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('내 정책 지도를 파일로 내보냈어요.');});
renderPeople();renderSaved();selectPolicy(selectedId);updateStorageNote();

for(const link of document.querySelectorAll('[data-galaxy-policy]')){
  link.setAttribute('aria-haspopup','dialog');
  link.setAttribute('aria-controls','policy-dialog');
  link.addEventListener('click',event=>{
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    openPolicy(link.dataset.galaxyPolicy,link);
  });
}
import('./policy-scene.js').catch(()=>{});

window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY&&event.key!==null)return;
  const focused=document.activeElement;
  const caret=focused?.tagName==='TEXTAREA'?{id:focused.id,start:focused.selectionStart,end:focused.selectionEnd}:null;
  try{saved=readSaved();storageAvailable=true;}catch{storageAvailable=false;}
  renderSaved();renderPeople();selectPolicy(selectedId);updateStorageNote();
  if(caret){const input=document.getElementById(caret.id);if(input){input.focus({preventScroll:true});input.setSelectionRange(caret.start,caret.end);}}
});
}
