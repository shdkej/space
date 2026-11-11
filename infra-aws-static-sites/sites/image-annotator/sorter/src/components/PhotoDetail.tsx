'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Download,Check} from 'lucide-react';
import type {Photo} from '../../lib/domain';
type Props={photo:Photo|null;categories:string[];onClose:()=>void;onChange:(id:string,category:string)=>Promise<void>};
export default function PhotoDetail({photo,categories,onClose,onChange}:Props){
  const ref=useRef<HTMLDialogElement>(null),[category,setCategory]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(photo){setCategory(photo.category||categories[0]);setError('');ref.current?.showModal();}else ref.current?.close();},[photo?.id]);
  if(!photo)return <dialog ref={ref}/>;
  const options=Array.from(new Set([...categories,...(photo.category?[photo.category]:[])]));
  const probabilities:Record<string,number>=photo.probabilities?JSON.parse(photo.probabilities):{};
  async function save(){if(!photo)return;setPending(true);try{await onChange(photo.id,category);onClose();}catch(e){setError((e as Error).message);}finally{setPending(false);}}
  return <dialog ref={ref} className="detail-dialog" aria-label={`${photo.name} 사진 상세`} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="detail-layout"><div className="detail-image"><img src={`/api/sort/photos/${photo.id}/preview`} alt={photo.name}/></div><div className="detail-info"><span className="eyebrow">사진 살펴보기</span><h2>{photo.name}</h2><p className="hint">{(photo.size/1024/1024).toFixed(1)} MB · {photo.status==='manual'?'직접 분류한 사진':photo.model||'분류 대기'}</p>
    {photo.confidence!==null&&<div className="confidence"><span>모델 확신도</span><strong>{Math.round(photo.confidence*100)}<small>%</small></strong></div>}
    {photo.status==='review'&&<p className="review-note">분류가 확실하지 않아요. 사진을 보고 어울리는 폴더를 골라 주세요.</p>}
    {photo.error&&<p className="review-note">{photo.error}</p>}
    {Object.keys(probabilities).length>0&&<div className="probabilities">{Object.entries(probabilities).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,value])=><div key={name}><div><span>{name}</span><span>{Math.round(value*100)}%</span></div><div className="probability-track"><i style={{width:`${value*100}%`}}/></div></div>)}</div>}
    <label htmlFor="manual-category">분류 폴더</label><select id="manual-category" value={category} onChange={e=>setCategory(e.target.value)}>{options.map(c=><option key={c}>{c}</option>)}</select>
    <button className="primary full" disabled={pending} onClick={save}><Check size={16}/>{pending?'저장 중…':'이 분류로 저장'}</button>
    <a className="secondary download-original" href={`/api/sort/photos/${photo.id}/original`}><Download size={16}/>보관된 사진 다운로드</a>{error&&<p role="alert">{error}</p>}
    </div></div><button className="close-detail" aria-label="사진 상세 닫기" onClick={onClose}><X size={23}/></button>
  </dialog>;
}
