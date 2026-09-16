'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { createSupabaseBrowser } from './supabase-browser';
import type { Profile, Lang, Theme } from './types';
import { toast } from 'sonner';

type AuthContextValue = { session:Session|null; user:User|null; profile:Profile|null; loading:boolean; lang:Lang; theme:Theme; setLang:(l:Lang)=>Promise<void>; setTheme:(t:Theme)=>Promise<void>; refreshProfile:()=>Promise<Profile|null>; signOut:()=>Promise<void>; };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({children}:{children:React.ReactNode}){
  const supabase = useMemo(()=>createSupabaseBrowser(),[]);
  const router=useRouter(); const pathname=usePathname();
  const [session,setSession]=useState<Session|null>(null); const [profile,setProfile]=useState<Profile|null>(null); const [loading,setLoading]=useState(true);
  const [lang,setLangState]=useState<Lang>('ta'); const [theme,setThemeState]=useState<Theme>('calm');
  const refreshProfile=async(activeSession=session)=>{ if(!activeSession?.user){setProfile(null);return null;} const {data,error}=await supabase.from('profiles').select('*').eq('id',activeSession.user.id).maybeSingle(); if(error){toast.error('Could not load your profile.'); return null;} if(data){setProfile(data as Profile); setLangState(data.preferred_lang); setThemeState(data.theme); return data as Profile;} return null; };
  useEffect(()=>{ let active=true; supabase.auth.getSession().then(async({data})=>{ if(!active)return; setSession(data.session); if(data.session){await refreshProfile(data.session);} setLoading(false);}); const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,next)=>{ setSession(next); if(next){ setLoading(true); await refreshProfile(next); setLoading(false); } else { setProfile(null); setLoading(false); setLangState('ta'); setThemeState((localStorage.getItem('tholan-theme') as Theme)||'calm'); } }); return()=>{active=false;subscription.unsubscribe();}; },[supabase]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  useEffect(()=>{if(loading)return; const genericEmergency=pathname==='/emergency' && typeof window!=='undefined' && new URLSearchParams(window.location.search).get('generic')==='1'; if(!session){ if(pathname!=='/login' && !genericEmergency) router.replace('/login'); return;} if(!profile){return;} if(!profile.onboarding_complete && pathname!=='/signup-essentials' && pathname!=='/login' && pathname!=='/emergency'){router.replace('/signup-essentials');} if(profile.onboarding_complete && (pathname==='/login'||pathname==='/signup-essentials')){router.replace('/');}},[loading,session,profile,pathname,router]);
  const setLang=async(l:Lang)=>{setLangState(l); if(session?.user){const {error}=await supabase.from('profiles').update({preferred_lang:l}).eq('id',session.user.id); if(error){toast.error('Could not save language.'); return;} setProfile(p=>p?{...p,preferred_lang:l}:p);} };
  const setTheme=async(t:Theme)=>{setThemeState(t); localStorage.setItem('tholan-theme',t); if(session?.user){const {error}=await supabase.from('profiles').update({theme:t}).eq('id',session.user.id); if(error){toast.error('Could not save theme.'); return;} setProfile(p=>p?{...p,theme:t}:p);} };
  const signOut=async()=>{await supabase.auth.signOut(); setSession(null);setProfile(null); setLangState('ta');setThemeState((localStorage.getItem('tholan-theme') as Theme)||'calm'); localStorage.removeItem('tholan-profile-cache'); router.replace('/login');};
  return <AuthContext.Provider value={{session,user:session?.user??null,profile,loading,lang,theme,setLang,setTheme,refreshProfile,signOut}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const c=useContext(AuthContext);if(!c)throw new Error('useAuth must be inside AuthProvider');return c;}
