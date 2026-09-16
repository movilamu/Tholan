'use client';
import { useEffect, useState } from 'react';
import { Phone, MessageSquare, Siren, MapPin, AlertTriangle, Navigation, ShieldAlert } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../lib/auth-context';
import { createSupabaseBrowser } from '../../lib/supabase-browser';
import dynamic from 'next/dynamic';
const LeafletMap = dynamic(()=>import('../../components/LeafletMap').then(m=>m.LeafletMap),{ssr:false});
import type { Condition, Medication, Hospital, EmergencyContact } from '../../lib/types';
import { t } from '../../lib/i18n';
import { toast } from 'sonner';

const severities = ['Low', 'Moderate', 'High', 'Critical'] as const;
type Severity = typeof severities[number];
const aids = {
  en: {
    'Dizziness / low BP': ['Sit or lie down somewhere safe and avoid standing suddenly.','If awake and able to swallow, consider normal fluids while arranging medical assessment.','Seek urgent care for fainting, chest pain, severe breathlessness, confusion, weakness on one side, or ongoing symptoms.'],
    'Heat stroke': ['Move to a cool place and remove excess clothing.','Cool the person promptly with cool wet cloths/fanning or other available cooling measures.','Heat stroke is an emergency: call for urgent medical help, especially with confusion, collapse, or seizures.'],
    'Snake bite': ['Keep the person calm and still; immobilize the affected limb if possible.','Seek urgent medical care immediately and avoid cutting, sucking, or applying a tourniquet to the bite.','Do not delay transport while trying home remedies.']
  },
  ta: {
    'மயக்கம் / குறைந்த இரத்த அழுத்தம்': ['பாதுகாப்பான இடத்தில் உட்காருங்கள் அல்லது படுத்துக்கொள்ளுங்கள்; திடீரென எழுந்திருக்க வேண்டாம்.','விழிப்புடன் விழுங்க முடிந்தால், மருத்துவ உதவி ஏற்பாடு செய்யும் போது சாதாரண திரவங்களை பரிசீலிக்கலாம்.','மயக்கம், மார்பு வலி, கடுமையான மூச்சுத்திணறல், குழப்பம் அல்லது நீடிக்கும் அறிகுறிகள் இருந்தால் அவசர உதவி பெறுங்கள்.'],
    'வெப்ப அதிர்ச்சி': ['குளிர்ந்த இடத்துக்கு மாற்றி, அதிகமான ஆடைகளை அகற்றுங்கள்.','குளிர்ந்த ஈரத் துணி/விசிறி போன்றவற்றால் உடலை விரைவாக குளிர்விக்கவும்.','குழப்பம், சரிவு அல்லது fits இருந்தால் உடனடி மருத்துவ உதவி தேவை.'],
    'பாம்பு கடி': ['அமைதியாக வைத்துக் கொண்டு, பாதிக்கப்பட்ட உறுப்பை முடிந்தால் அசையாமல் வைத்திருங்கள்.','உடனடி மருத்துவமனை உதவியை நாடுங்கள்; காயத்தை வெட்டவோ, உறிஞ்சவோ, tourniquet போடவோ வேண்டாம்.','வீட்டு வைத்தியத்திற்காக போக்குவரத்தை தாமதிக்க வேண்டாம்.']
  }
} as const;

export default function EmergencyPage(){
  const { user, profile, lang } = useAuth();
  const [severity,setSeverity]=useState<Severity>('High');
  const [count,setCount]=useState(10);
  const [running,setRunning]=useState(false);
  const [executed,setExecuted]=useState(false);
  const [coords,setCoords]=useState<[number,number]|null>(null);
  const [hospital,setHospital]=useState<{name:string;lat:number;lon:number;phone?:string}>();
  const [route,setRoute]=useState<[number,number][]>([]);
  const [records,setRecords]=useState<{conditions:Condition[];medications:Medication[];primary?:Hospital;contact?:EmergencyContact}>({conditions:[],medications:[]});
  const [lookupLoading,setLookupLoading]=useState(false);
  const [generic,setGeneric]=useState(false);
  const [placeName,setPlaceName]=useState('');

  useEffect(()=>{const p=new URLSearchParams(window.location.search);setGeneric(p.get('generic')==='1');},[]);
  useEffect(()=>{if(!user||!profile?.onboarding_complete)return;const s=createSupabaseBrowser();Promise.all([
    s.from('conditions').select('*').order('created_at',{ascending:false}),
    s.from('medications').select('*').order('created_at',{ascending:false}),
    s.from('hospitals').select('*').eq('is_primary',true).limit(1),
    s.from('emergency_contacts').select('*').order('created_at',{ascending:true}).limit(1)
  ]).then(([c,m,h,e])=>{const er=c.error||m.error||h.error||e.error;if(er){toast.error('Emergency profile data could not be loaded.');return;}setRecords({conditions:(c.data||[]) as Condition[],medications:(m.data||[]) as Medication[],primary:(h.data||[])[0] as Hospital|undefined,contact:(e.data||[])[0] as EmergencyContact|undefined});});},[user,profile]);
  useEffect(()=>{if(generic){setSeverity('High');setCount(10);setRunning(true);}},[generic]);
  useEffect(()=>{if(!running)return;const id=window.setInterval(()=>setCount(c=>{if(c<=1){window.clearInterval(id);setRunning(false);setExecuted(true);return 0;}return c-1;}),1000);return()=>window.clearInterval(id);},[running]);
  useEffect(()=>{if(!executed)return;if(!navigator.geolocation){toast.error('This browser does not expose geolocation.');return;}setLookupLoading(true);navigator.geolocation.getCurrentPosition(async(pos)=>{
    const u:[number,number]=[pos.coords.latitude,pos.coords.longitude];setCoords(u);
    try{
      const useNearest=generic||severity==='High'||severity==='Critical';
      let results:any[]=[];
      if(useNearest){
        const reverse=await fetch(`/api/location/reverse?lat=${u[0]}&lon=${u[1]}`);if(reverse.ok){const rv=await reverse.json();setPlaceName(rv?.display_name||rv?.name||'Current device location');}
        await new Promise(r=>setTimeout(r,1100));
        const r=await fetch(`/api/nominatim?q=hospital&lat=${u[0]}&lon=${u[1]}`);results=await r.json();
      } else if(records.primary){
        const r=await fetch(`/api/nominatim?q=${encodeURIComponent(records.primary.name)}`);results=await r.json();
      }
      if(!Array.isArray(results)||!results.length)throw new Error('No hospital was found for this location.');
      const ranked=results.map((x:any)=>({...x,d2:Math.pow(Number(x.lat)-u[0],2)+Math.pow(Number(x.lon)-u[1],2)})).sort((a:any,b:any)=>a.d2-b.d2);
      const h=ranked[0];
      const hs={name:h.display_name?.split(',').slice(0,2).join(',')||records.primary?.name||'Hospital',lat:Number(h.lat),lon:Number(h.lon),phone:!useNearest?records.primary?.phone_number:undefined};
      setHospital(hs);
      await new Promise(r=>setTimeout(r,1000));
      const rr=await fetch(`/api/osrm?from=${u[1]},${u[0]}&to=${hs.lon},${hs.lat}`);const rj=await rr.json();
      const line=rj?.routes?.[0]?.geometry?.coordinates?.map((p:[number,number])=>[p[1],p[0]] as [number,number])||[];setRoute(line);
      if(!line.length)toast.info('Hospital found; route geometry is unavailable right now.');
    }catch(e){toast.error(e instanceof Error?e.message:'Could not build the emergency route.');}finally{setLookupLoading(false);}
  },()=>{setLookupLoading(false);toast.error('Location permission was not granted. You can still use the phone actions below.');},{enableHighAccuracy:true,timeout:10000,maximumAge:30000});},[executed,generic,severity,records.primary]);
  const cancel=()=>{setRunning(false);setCount(10);if(generic)toast.info('Generic emergency countdown cancelled.');};
  const start=()=>{setCount(10);setExecuted(false);setRunning(true);setCoords(null);setHospital(undefined);setRoute([]);};
  const aid=generic?{}:lang==='ta'?aids.ta:aids.en;
  const smsText=`Tholan emergency alert: ${profile?.name||'I'} may need help. Severity: ${severity}. Please check on me.`;
  return <AppShell><PageHeader title="🚨 Emergency" subtitle="Fast, explicit actions with a visible countdown. Hospital notification is permanently simulated and never transmitted."/>
    <div className="app-surface rounded-3xl p-5 md:p-7" style={{borderColor:'color-mix(in srgb,var(--danger) 38%,var(--border))'}}>
      <div className="flex flex-wrap gap-3 items-center justify-between"><div><div className="text-sm font-black uppercase tracking-wider" style={{color:'var(--danger)'}}>Emergency protocol</div><h2 className="text-2xl font-black mt-1">Select current severity</h2></div><div className="flex gap-2 flex-wrap">{severities.map(s=><button key={s} disabled={running||generic} onClick={()=>setSeverity(s)} className="rounded-full px-4 py-2 border font-black" style={{borderColor:severity===s?'var(--danger)':'var(--border)',background:severity===s?'color-mix(in srgb,var(--danger) 12%,var(--surface))':'var(--surface)',color:severity===s?'var(--danger)':'var(--text)'}}>{s}</button>)}</div></div>
      {running&&<div className="mt-7 text-center"><div className="text-7xl font-black" style={{color:'var(--danger)'}}>{count}</div><div className="font-bold">Confirming in seconds unless cancelled</div><button onClick={cancel} className="mt-5 rounded-xl border px-6 py-3 font-black" style={{borderColor:'var(--border)'}}>Cancel emergency flow</button></div>}
      {!running&&!executed&&<div className="mt-6 rounded-2xl p-5" style={{background:'color-mix(in srgb,var(--danger) 8%,var(--surface))'}}><div className="flex items-start gap-3"><ShieldAlert style={{color:'var(--danger)'}}/><div><div className="font-bold">10-second visible confirmation</div><p className="text-sm mt-1" style={{color:'var(--muted)'}}>No emergency escalation starts until the countdown reaches zero.</p></div></div><button onClick={start} className="mt-5 w-full md:w-auto rounded-xl px-8 py-4 text-white font-black text-lg" style={{background:'var(--danger)'}}><Siren className="inline mr-2" size={21}/> Start emergency protocol</button></div>}
      {executed&&<>
        <div className="mt-7 grid lg:grid-cols-[1.05fr_.95fr] gap-6"><section className="rounded-2xl overflow-hidden border min-h-[390px]" style={{borderColor:'var(--border)'}}>{coords?<LeafletMap user={coords} hospital={hospital} route={route}/>:<div className="h-full min-h-[390px] flex items-center justify-center"><div className="text-center p-6"><MapPin className="mx-auto" style={{color:'var(--danger)'}}/><div className="font-black mt-2">{lookupLoading?'Finding a real hospital and route…':'Location unavailable'}</div><div className="text-sm mt-1" style={{color:'var(--muted)'}}>Allow location access to populate the map.</div></div></div>}</section>
          <section className="space-y-4"><div className="rounded-2xl p-4 border" style={{borderColor:'var(--border)'}}><div className="font-black">{hospital?.name||'Hospital search pending'}</div><div className="text-sm mt-1" style={{color:'var(--muted)'}}>{generic?'Generic protocol: nearest hospital search':severity==='High'||severity==='Critical'?'High/Critical: nearest hospital lookup':'Low/Moderate: stored primary hospital'}</div></div>
            <div className="grid gap-3"><a href="tel:108" className="rounded-xl px-4 py-3 text-white font-black text-center" style={{background:'var(--danger)'}}><Phone className="inline mr-2" size={18}/> {t(lang,'callAmbulance')} · 108</a>{records.primary&&<a href={`tel:${records.primary.phone_number}`} className="rounded-xl px-4 py-3 border font-black text-center" style={{borderColor:'var(--border)'}}><Phone className="inline mr-2" size={18}/> {t(lang,'callHospital')}</a>}{records.contact&&<a href={`tel:${records.contact.phone_number}`} className="rounded-xl px-4 py-3 border font-black text-center" style={{borderColor:'var(--border)'}}><Phone className="inline mr-2" size={18}/> {t(lang,'callContact')} · {records.contact.name}</a>}{records.contact&&<a href={`sms:${records.contact.phone_number}?body=${encodeURIComponent(smsText)}`} className="rounded-xl px-4 py-3 border font-black text-center" style={{borderColor:'var(--success)'}}><MessageSquare className="inline mr-2" size={18}/> SMS emergency contact</a>}</div>
            <div className="rounded-2xl p-4" style={{background:'color-mix(in srgb,var(--warning) 11%,var(--surface))'}}><div className="font-black" style={{color:'var(--warning)'}}>📩 SIMULATED — NOT SENT</div><p className="text-sm mt-2">Exactly what a hospital message would contain (display only):</p><pre className="mt-3 text-xs whitespace-pre-wrap font-sans">Name: {profile?.name||'Not recorded'}{`\n`}Age: {profile?.age??'Not recorded'}{`\n`}Severity: {severity}{`\n`}Conditions: {records.conditions.map(x=>x.name).join(', ')||'None recorded'}{`\n`}Medications: {records.medications.map(x=>`${x.name}${x.dosage?` (${x.dosage})`:''}`).join(', ')||'None recorded'}</pre></div>
          </section></div>
        {generic&&<div className="mt-6 rounded-2xl p-5" style={{background:'color-mix(in srgb,var(--warning) 11%,var(--surface))'}}><div className="font-black">Location handoff · SIMULATED — NOT SENT</div><p className="text-sm mt-2">No hospital message has been transmitted. Nominatim identified this emergency location as: <span className="font-bold">{placeName||'Current device location'}</span>. Nearby hospital search is informational only.</p><a href="/signup-essentials" className="inline-block mt-4 font-bold" style={{color:'var(--brand)'}}>Complete your profile for faster help next time →</a></div>}
        {!generic&&<div className="mt-6"><div className="flex items-center gap-2 mb-3"><AlertTriangle size={18} style={{color:'var(--warning)'}}/><h2 className="text-xl font-black">{lang==='ta'?'முதலுதவி வழிகாட்டல்':'First-aid guidance'}</h2></div><div className="grid md:grid-cols-3 gap-4">{Object.entries(aid).map(([title,items])=><div key={title} className="app-surface rounded-2xl p-5"><h3 className="font-black">{title}</h3><ol className="mt-3 space-y-2 text-sm list-decimal pl-5">{items.map(x=><li key={x}>{x}</li>)}</ol><div className="text-[11px] mt-4 font-semibold" style={{color:'var(--warning)'}}>{t(lang,'guidance')}</div></div>)}</div></div>}
      </>}
      <div className="mt-5 text-xs flex items-center gap-2" style={{color:'var(--muted)'}}><Navigation size={14}/> Native dialing/SMS opens the device's own apps. Tholan does not place calls or send SMS automatically.</div>
    </div></AppShell>;
}
