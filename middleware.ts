import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(request:NextRequest){
  let response=NextResponse.next({request});
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(cookiesToSet)=>{cookiesToSet.forEach(({name,value,options})=>{response.cookies.set(name,value,options);});}}});
  const {data:{user}}=await supabase.auth.getUser(); const pathname=request.nextUrl.pathname;
  const genericEmergency=pathname==='/emergency' && request.nextUrl.searchParams.get('generic')==='1';
  if(pathname==='/auth/callback') return response;
  if(!user && pathname!=='/login' && !genericEmergency) return NextResponse.redirect(new URL('/login',request.url));
  if(user && pathname==='/login') return NextResponse.redirect(new URL('/',request.url));
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
