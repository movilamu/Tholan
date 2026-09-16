'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { createSupabaseBrowser } from '../../lib/supabase-browser';
import { FloatingSOS } from '../../components/FloatingSOS';
import { toast } from 'sonner';

const steps = ['Identity', 'Safety', 'Care', 'Coverage'];

type FormState = {
  name:string; age:string; preferred_lang:'en'|'ta'; phone_number:string; condition:string; conditionSince:string;
  contactName:string; contactPhone:string; relation:string; canDecide:boolean; hospitalName:string; hospitalPhone:string;
  scheme:'CMCHIS'|'Ayushman Bharat'|'Private'|'None'; insuranceProvider:string; insurancePolicy:string;
};

export default function SignupEssentials(){
  const router=useRouter(); const {user,profile,lang,refreshProfile}=useAuth();
  const [step,setStep]=useState(0); const [busy,setBusy]=useState(false);
  const [form,setForm]=useState<FormState>({name:'',age:'',preferred_lang:lang,phone_number:'',condition:'',conditionSince:'',contactName:'',contactPhone:'',relation:'',canDecide:false,hospitalName:'',hospitalPhone:'',scheme:'None',insuranceProvider:'',insurancePolicy:''});
  useEffect(()=>{if(profile){setForm(f=>({...f,name:profile.name||'',age:profile.age?.toString()||'',preferred_lang:profile.preferred_lang,phone_number:profile.phone_number||'',insuranceProvider:profile.insurance_provider||'',insurancePolicy:profile.insurance_policy_number||''}));}},[profile]);
  const update=(key:keyof FormState,value:FormState[keyof FormState])=>setForm(f=>({...f,[key]:value}));
  const next=(e:FormEvent)=>{e.preventDefault();
    if(step===0 && (!form.name.trim()||!form.age||!form.phone_number.trim())) return toast.error('Please complete name, age and real phone number.');
    if(step===1 && (!form.contactName.trim()||!form.contactPhone.trim())) return toast.error('Add at least one emergency contact.');
    if(step===2 && (!form.hospitalName.trim()||!form.hospitalPhone.trim())) return toast.error('Add your primary hospital and phone number.');
    setStep(s=>Math.min(3,s+1));
  };
  const submit=async(e:FormEvent)=>{e.preventDefault(); if(!user)return; setBusy(true); const s=createSupabaseBrowser();
    const {error:pe}=await s.from('profiles').update({name:form.name.trim(),age:Number(form.age),preferred_lang:form.preferred_lang,phone_number:form.phone_number.trim(),insurance_provider:form.insuranceProvider.trim()||null,insurance_policy_number:form.insurancePolicy.trim()||null,onboarding_complete:true}).eq('id',user.id);
    if(pe){setBusy(false);return toast.error(pe.message);}
    const [existingC,existingH,existingE]=await Promise.all([
      s.from('conditions').select('id').eq('user_id',user.id),s.from('hospitals').select('id').eq('user_id',user.id).eq('is_primary',true),s.from('emergency_contacts').select('id').eq('user_id',user.id)
    ]);
    if(existingC.error||existingH.error||existingE.error){setBusy(false);return toast.error('Could not verify existing safety records.');}
    const tasks:any[]=[];
    if(!existingC.data?.length && form.condition.trim())tasks.push(s.from('conditions').insert({user_id:user.id,name:form.condition.trim(),since:form.conditionSince.trim()||null}));
    if(!existingE.data?.length)tasks.push(s.from('emergency_contacts').insert({user_id:user.id,name:form.contactName.trim(),phone_number:form.contactPhone.trim(),relation:form.relation.trim()||null,can_decide:form.canDecide}));
    if(!existingH.data?.length)tasks.push(s.from('hospitals').insert({user_id:user.id,name:form.hospitalName.trim(),phone_number:form.hospitalPhone.trim(),is_primary:true,scheme:form.scheme}));
    const results=await Promise.all(tasks); const err=results.find(r=>r.error)?.error; if(err){setBusy(false);return toast.error(err.message);}
    await refreshProfile(); setBusy(false); toast.success('Profile completed.'); router.replace('/');
  };
  const disabled=busy;
  return <div className="min-h-screen p-5 md:p-10" style={{background:'var(--bg)'}}><FloatingSOS/><div className="max-w-3xl mx-auto"><div className="app-surface rounded-3xl p-6 md:p-9">
    <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-black" style={{color:'var(--brand)'}}>Tholan onboarding</div><h1 className="text-3xl font-black mt-1">Set up your emergency-ready profile</h1><p className="mt-2" style={{color:'var(--muted)'}}>Use real details so emergency actions have information they can actually use.</p></div><div className="text-sm font-black">{step+1}/{steps.length}</div></div>
    <div className="grid grid-cols-4 gap-2 mt-8">{steps.map((x,i)=><div key={x}><div className="h-2 rounded-full" style={{background:i<=step?'var(--brand)':'var(--border)'}}/><div className="text-xs mt-2 font-semibold" style={{color:i<=step?'var(--brand)':'var(--muted)'}}>{x}</div></div>)}</div>
    <form onSubmit={step===3?submit:next} className="mt-8 space-y-5">
      {step===0 && <><Field label="Full name" value={form.name} onChange={v=>update('name',v)}/><Field label="Age" type="number" value={form.age} onChange={v=>update('age',v)}/><Field label="Real phone number" type="tel" value={form.phone_number} onChange={v=>update('phone_number',v)}/><div><label className="text-sm font-bold">Preferred language</label><div className="grid grid-cols-2 gap-3 mt-2"><Choice active={form.preferred_lang==='ta'} onClick={()=>update('preferred_lang','ta')}>தமிழ்</Choice><Choice active={form.preferred_lang==='en'} onClick={()=>update('preferred_lang','en')}>English</Choice></div></div></>}
      {step===1 && <><Field label="Medical condition (leave blank for None currently)" value={form.condition} onChange={v=>update('condition',v)}/><Field label="Since (optional)" value={form.conditionSince} onChange={v=>update('conditionSince',v)}/><div className="border-t pt-5" style={{borderColor:'var(--border)'}}><h2 className="font-black text-xl">👨‍👩‍👦 Emergency contact</h2><div className="grid md:grid-cols-2 gap-4 mt-4"><Field label="Name" value={form.contactName} onChange={v=>update('contactName',v)}/><Field label="Real phone number" type="tel" value={form.contactPhone} onChange={v=>update('contactPhone',v)}/><Field label="Relationship" value={form.relation} onChange={v=>update('relation',v)}/></div><label className="flex items-center gap-2 mt-4 text-sm font-semibold"><input type="checkbox" checked={form.canDecide} onChange={e=>update('canDecide',e.target.checked)}/> Can help make emergency decisions</label></div></>}
      {step===2 && <><h2 className="font-black text-xl">🏥 Primary hospital</h2><div className="grid md:grid-cols-2 gap-4"><Field label="Hospital name" value={form.hospitalName} onChange={v=>update('hospitalName',v)}/><Field label="Real hospital phone number" type="tel" value={form.hospitalPhone} onChange={v=>update('hospitalPhone',v)}/></div><div><label className="text-sm font-bold">Government / care scheme</label><select value={form.scheme} onChange={e=>update('scheme',e.target.value as FormState['scheme'])} className="w-full mt-2 rounded-xl border px-3 py-3" style={{borderColor:'var(--border)',background:'var(--bg)',color:'var(--text)'}}><option>None</option><option>CMCHIS</option><option>Ayushman Bharat</option><option>Private</option></select></div></>}
      {step===3 && <><h2 className="font-black text-xl">Insurance details</h2><p className="text-sm" style={{color:'var(--muted)'}}>Optional reference-only details. Tholan does not connect to an insurer.</p><Field label="Provider (optional)" value={form.insuranceProvider} onChange={v=>update('insuranceProvider',v)}/><Field label="Policy number (optional)" value={form.insurancePolicy} onChange={v=>update('insurancePolicy',v)}/><div className="rounded-2xl p-4" style={{background:'var(--surface-strong)'}}><div className="font-bold">Ready to finish</div><div className="text-sm mt-1" style={{color:'var(--muted)'}}>Your information will be written to your authenticated Supabase records.</div></div></>}
      <div className="flex justify-between gap-3 pt-3"><button type="button" disabled={step===0||disabled} onClick={()=>setStep(s=>Math.max(0,s-1))} className="rounded-xl px-5 py-3 border font-bold disabled:opacity-40" style={{borderColor:'var(--border)'}}>Back</button><button disabled={disabled} className="rounded-xl px-6 py-3 text-white font-black" style={{background:'var(--brand)'}}>{busy?'Saving…':step===3?'Complete profile':'Continue'}</button></div>
    </form>
  </div></div></div>
}
function Field({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){const optional=label.toLowerCase().includes('optional')||label.toLowerCase().includes('leave blank');return <label className="block"><span className="text-sm font-bold">{label}</span><input required={!optional} min={type==='number'?'1':undefined} type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full mt-2 rounded-xl border px-3 py-3 outline-none" style={{borderColor:'var(--border)',background:'var(--bg)',color:'var(--text)'}}/></label>}
function Choice({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){return <button type="button" onClick={onClick} className="rounded-xl border py-3 font-bold" style={{borderColor:active?'var(--brand)':'var(--border)',background:active?'var(--surface-strong)':'var(--bg)',color:active?'var(--brand)':'var(--text)'}}>{children}</button>}
