create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age int,
  preferred_lang text default 'ta' check (preferred_lang in ('en','ta')),
  theme text default 'calm' check (theme in ('calm','high_contrast','dark')),
  phone_number text,
  insurance_provider text,
  insurance_policy_number text,
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);
create table if not exists public.conditions (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null, since text, notes text, created_at timestamptz default now()
);
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null, dosage text, prescribed_for text,
  added_from text check (added_from in ('onboarding','record-scan','chatbot')),
  side_effects_reported text, side_effect_action text, created_at timestamptz default now()
);
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null, phone_number text not null, is_primary boolean default false,
  scheme text check (scheme in ('CMCHIS','Ayushman Bharat','Private','None')),
  created_at timestamptz default now()
);
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null, phone_number text not null, relation text, can_decide boolean default false,
  created_at timestamptz default now()
);
create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('user','assistant')), content text, created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.conditions enable row level security;
alter table public.medications enable row level security;
alter table public.hospitals enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.chat_history enable row level security;

drop policy if exists "own_profile" on public.profiles;
create policy "own_profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "own_conditions" on public.conditions;
create policy "own_conditions" on public.conditions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_medications" on public.medications;
create policy "own_medications" on public.medications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_hospitals" on public.hospitals;
create policy "own_hospitals" on public.hospitals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_contacts" on public.emergency_contacts;
create policy "own_contacts" on public.emergency_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_chat_history" on public.chat_history;
create policy "own_chat_history" on public.chat_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public) values ('medical-records','medical-records',false) on conflict (id) do nothing;

drop policy if exists "records_insert_own" on storage.objects;
create policy "records_insert_own" on storage.objects for insert to authenticated with check (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "records_select_own" on storage.objects;
create policy "records_select_own" on storage.objects for select to authenticated using (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "records_delete_own" on storage.objects;
create policy "records_delete_own" on storage.objects for delete to authenticated using (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text);
