import { imageDimensions, MAX_FILE_BYTES } from './domain';
export async function preparePhoto(file:File):Promise<Blob>{
  if(file.size>MAX_FILE_BYTES)throw new Error('20MB 이하의 사진을 선택해 주세요.');
  if(!/\.(jpe?g|png|webp)$/i.test(file.name)&&!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG, PNG, WebP만 지원해요. HEIC는 JPEG로 변환해 주세요.');
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('사진을 열지 못했어요. JPEG 또는 PNG로 다시 저장해 주세요.');}
  try{
    const d=imageDimensions(bitmap.width,bitmap.height);
    const canvas=document.createElement('canvas');canvas.width=d.width;canvas.height=d.height;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('이 브라우저에서 사진을 준비하지 못했어요.');
    ctx.fillStyle='#fffdf2';ctx.fillRect(0,0,d.width,d.height);
    ctx.drawImage(bitmap,(d.width-d.drawWidth)/2,(d.height-d.drawHeight)/2,d.drawWidth,d.drawHeight);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('사진 변환에 실패했어요.')),'image/jpeg',0.86));
  }finally{bitmap.close();}
}
