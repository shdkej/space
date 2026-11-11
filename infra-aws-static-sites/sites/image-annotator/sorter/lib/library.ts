import {csvCell,type Photo} from './domain.ts';
export async function loadPhotos(request:(url:string)=>Promise<{photos:Photo[];cursor?:string|null}>):Promise<Photo[]> {
 const photos=new Map<string,Photo>();const cursors=new Set<string>();let cursor:string|null=null;
 do {
  const page=await request('/api/sort/photos?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  for(const photo of page.photos)photos.set(photo.id,photo);
  cursor=page.cursor||null;
  if(cursor&&cursors.has(cursor))throw new Error('사진 목록을 이어서 읽지 못했어요. 다시 불러와 주세요.');
  if(cursor)cursors.add(cursor);
 }while(cursor);
 return [...photos.values()].sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id));
}
export function exportPhotos(photos:Photo[],filter:string) {
 return photos.filter(p=>filter.startsWith('category:')?p.category===filter.slice(9):filter==='review'?p.status==='review':filter==='pending'?['pending','error','processing'].includes(p.status):true);
}
export function buildCsv(photos:Photo[]) {
 const rows:unknown[][]=[['파일명','이미지 키','분류','내용 태그','상태','모델 확신도','모델'],...photos.map(p=>[p.name,p.original_key,p.category,JSON.parse(p.tags||'[]').join(', '),p.status,p.confidence,p.model])];
 return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
