import { NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../lib/supabase-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_oauth_code', url.origin));
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const message = encodeURIComponent(error.message);
    return NextResponse.redirect(new URL(`/login?error=${message}`, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=session_not_created', url.origin));
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    const message = encodeURIComponent('Your account was signed in, but your profile could not be loaded.');
    return NextResponse.redirect(new URL(`/login?error=${message}`, url.origin));
  }

  const destination = next === '/emergency' ? '/emergency' : profile?.onboarding_complete ? '/' : '/signup-essentials';
  return NextResponse.redirect(new URL(destination, url.origin));
}
