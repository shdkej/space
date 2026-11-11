import {BlobWriter,ZipWriter} from '@zip.js/zip.js';
import {exportPath,safeFilename,type Photo} from './domain.ts';
export async function buildZip(photos:Photo[],progress:(done:number)=>void=()=>{},request:typeof fetch=fetch):Promise<Blob>{
 const writer=new BlobWriter('application/zip');const zip=new ZipWriter(writer,{level:0,useWebWorkers:false});let total=0;
 for(let i=0;i<photos.length;i++){
  const photo=photos[i];const r=await request(`/api/sort/photos/${photo.id}/preview`,{signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`${photo.name} 다운로드에 실패했어요. ZIP을 다시 준비해 주세요.`);
  const blob=await r.blob();total+=blob.size;
  if(total>128*1024*1024)throw new Error('ZIP 한 번에 128MB까지 준비할 수 있어요. 분류 폴더별로 나누어 다운로드해 주세요.');
  await zip.add(exportPath({...photo,name:safeFilename(photo.name).replace(/\.[^.]+$/,'')+'.webp'}),blob.stream(),{level:0});progress(i+1);
 }
 return await zip.close();
}
