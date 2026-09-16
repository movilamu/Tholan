'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Siren } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
export function FloatingSOS(){
 const router=useRouter(); const {profile}=useAuth(); const [pressed,setPressed]=useState(false); const [progress,setProgress]=useState(0); const timer=useRef<number|null>(null); const start=()=>{if(timer.current)return; setPressed(true); const started=Date.now(); timer.current=window.setInterval(()=>{const p=Math.min(1,(Date.now()-started)/1500);setProgress(p);if(p>=1){stop(); if(profile?.onboarding_complete)router.push('/emergency'); else router.push('/emergency?generic=1');}},30);}; const stop=()=>{if(timer.current)window.clearInterval(timer.current);timer.current=null;setPressed(false);setProgress(0);}; useEffect(()=>()=>stop(),[]);
 return <div className="fixed right-5 bottom-5 z-[1000]"><button aria-label="Press and hold SOS for emergency" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={e=>e.preventDefault()} className="relative h-[76px] w-[76px] rounded-full shadow-2xl flex flex-col items-center justify-center select-none touch-none" style={{background:'var(--danger)',color:'white'}}>{pressed&&<span className="absolute inset-[-5px] rounded-full sos-ring" style={{['--progress' as any]:`${progress*360}deg`}}/>}<span className="relative flex flex-col items-center"><Siren size={22}/><span className="text-xs font-black mt-0.5">SOS</span></span></button><div className="text-[10px] text-center mt-1 font-semibold" style={{color:'var(--muted)'}}>Hold 1.5s</div></div>
}
