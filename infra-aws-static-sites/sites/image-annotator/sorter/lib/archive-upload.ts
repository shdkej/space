const inflight=new Map<string,Promise<any>>();
type UploadCache=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export async function uploadToArchive(file:File,request:typeof fetch=fetch,storage:UploadCache=sessionStorage):Promise<any>{
 if(!/\.(jpe?g|png|webp)$/i.test(file.name)||!file.size||file.size>20*1024*1024)throw new Error('JPEG, PNG, WebP 사진을 장당 20MB 이하로 올려 주세요.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const prior=inflight.get(hash);if(prior)return {...await prior,duplicate:true};
 const operation=(async()=>{
  const json=async(url:string,init?:RequestInit)=>{const r=await request(url,{...init,signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok)throw new Error(d.error||'업로드 연결을 확인해 주세요.');return d;};
  const existing=await json('/api/sort/duplicates?hash='+hash);if(existing.photo)return{...existing,duplicate:true};
  const cacheKey='clef-upload:'+hash;let key:string|null=null;try{key=storage.getItem(cacheKey)}catch{}
  if(!key){const form=new FormData();form.append('file',file,file.name);const result=await json('https://upload.shdkej.com/browser-store',{method:'POST',body:form});key=result.key;if(typeof key!=='string'||!key.startsWith('original/')||key.includes('..'))throw new Error('업로드 결과를 확인하지 못했어요. 보관함을 불러와 확인해 주세요.');try{storage.setItem(cacheKey,key)}catch{}}
  const result=await json('/api/sort/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,hash,name:file.name,size:file.size})});try{storage.removeItem(cacheKey)}catch{}return result;
 })();inflight.set(hash,operation);try{return await operation}finally{inflight.delete(hash)}
}
