export const DEFAULT_CATEGORIES = ['장소', '음식', '자연', '인물', '동물', '건축·도시', '사물·제품', '문서·화면', '예술·콘텐츠', '일상'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_LIBRARY = 5000;
export type Photo = { id:string; name:string; size:number; status:string; category:string|null; confidence:number|null; probabilities:string|null; tags:string; model:string|null; error:string|null; created:number; updated:number; lease:number|null; original_key?:string };
export function validateCategories(value:unknown):string[] {
  if (!Array.isArray(value) || value.length<2 || value.length>24 || value.some(v=>typeof v!=='string')) throw new Error('분류는 2~24개로 입력해 주세요.');
  const values=value.map(v=>v.trim());
  if(values.some(v=>!v||v.length>40||/[\x00-\x1f]/.test(v))||new Set(values).size!==values.length) throw new Error('분류 이름은 중복 없이 1~40자로 입력해 주세요.');
  return values;
}
export function parseDecision(data:any,categories:string[],threshold:number) {
  const a=data?.answers?.category;
  const keys=categories.map((_,i)=>`c${i}`);
  const probability=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
  if(!a || a.type!=='choice'||!keys.includes(a.choice)||!probability(a.confidence)||!a.probabilities||keys.some(k=>!probability(a.probabilities[k]))||Object.keys(a.probabilities).length!==keys.length||Math.abs(keys.reduce((s,k)=>s+a.probabilities[k],0)-1)>0.02) throw new Error('Clef 응답을 확인할 수 없어요. 다시 분류해 주세요.');
  return {category:categories[keys.indexOf(a.choice)],confidence:a.confidence as number,probabilities:Object.fromEntries(keys.map((k,i)=>[categories[i],a.probabilities[k]])),status:a.confidence<threshold?'review':'done',model:typeof data.model==='string'?data.model:'@cf/cloudflare/clef'};
}
export function imageDimensions(width:number,height:number) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) throw new Error('사진 크기를 읽지 못했어요.');
  const scale=Math.min(1,1568/Math.max(width,height));
  const drawWidth=width*scale,drawHeight=height*scale;
  return {width:Math.max(280,Math.ceil(drawWidth)),height:Math.max(280,Math.ceil(drawHeight)),drawWidth,drawHeight};
}
export function safeFilename(value:string) {
  return (value.split(/[\\/]/).pop()||'photo').replace(/[\x00-\x1f<>:"|?*]/g,'_').replace(/^\.+/,'').slice(0,160)||'photo';
}
export function exportPath(p:{id:string;name:string;category:string|null;status:string}) {
  const folder=p.status==='review'?'검토필요':['done','manual','existing'].includes(p.status)?safeFilename(p.category||'기타'):'미분류';
  return `${folder}/${p.id}_${safeFilename(p.name)}`;
}
export function csvCell(value:unknown) {
  let s=String(value??''); if(/^\s*[=+\-@\t\r]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
