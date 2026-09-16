'use client';
import { Globe2, Moon, SunMedium, Eye } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
export function ThemeLanguage({hideLanguage=false}:{hideLanguage?:boolean}){const {lang,setLang,theme,setTheme}=useAuth(); return <div className="space-y-3">
  {!hideLanguage&&<><div className="flex items-center gap-2 text-sm font-semibold" style={{color:'var(--text)'}}><Globe2 size={17}/> Language</div>
  <div className="grid grid-cols-2 gap-2"><button onClick={()=>setLang('ta')} className={`rounded-xl px-3 py-2 border ${lang==='ta'?'font-bold':''}`} style={{borderColor:'var(--border)',background:lang==='ta'?'var(--surface-strong)':'transparent'}}>தமிழ்</button><button onClick={()=>setLang('en')} className={`rounded-xl px-3 py-2 border ${lang==='en'?'font-bold':''}`} style={{borderColor:'var(--border)',background:lang==='en'?'var(--surface-strong)':'transparent'}}>EN</button></div></>}
  <div className="flex items-center gap-2 text-sm font-semibold" style={{color:'var(--text)'}}><SunMedium size={17}/> Theme</div>
  <select value={theme} onChange={e=>setTheme(e.target.value as any)} className="w-full rounded-xl border px-3 py-2 outline-none" style={{borderColor:'var(--border)',background:'var(--surface)',color:'var(--text)'}}><option value="calm">Calm</option><option value="high_contrast">High contrast</option><option value="dark">Dark</option></select>
  <p className="text-xs" style={{color:'var(--muted)'}}><Moon size={12} className="inline mr-1"/> <Eye size={12} className="inline mr-1"/> Preferences sync to your profile.</p>
</div>}
