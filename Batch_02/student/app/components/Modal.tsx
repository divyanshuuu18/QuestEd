'use client';
import {useEffect,useRef} from 'react';
export default function Modal({children,title,onClose}:{children:React.ReactNode;title:string;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);
  return <dialog className="questModal" ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current)onClose()}}><div className="modalContent"><button className="modalClose" onClick={onClose} aria-label="Close dialog">×</button>{children}</div></dialog>
}
