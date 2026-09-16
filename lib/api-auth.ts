import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';
export async function requireUser() {
  const supabase = createSupabaseServer();
  const { data:{user}, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, response: NextResponse.json({error:'Unauthorized'},{status:401}), user:null };
  return { supabase, response:null, user };
}
