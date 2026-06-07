-- Ikigai Dashboard — cloud sync schema
-- Offline-first hybrid model: date-keyed JSON blobs live in `entries`,
-- normalized data in `profiles` and `habits`, everything else in `settings`.
-- Every table is owner-scoped via RLS on auth.uid(). Last-Write-Wins uses updated_at.

-- ───────────────────────── helpers ─────────────────────────
-- Touch updated_at on every UPDATE (LWW timestamp authority is the client,
-- but this guarantees monotonic server time if a client omits it).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is null or new.updated_at <= old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ───────────────────────── profiles ─────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar       text,
  updated_at   timestamptz not null default now(),
  deleted      boolean     not null default false
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── settings ─────────────────────────
-- Generic per-user key/JSONB store for all singleton settings.
create table if not exists public.settings (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  payload    jsonb,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, key)
);

alter table public.settings enable row level security;

create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_delete_own" on public.settings
  for delete using (auth.uid() = user_id);

create index if not exists settings_user_updated_idx
  on public.settings (user_id, updated_at);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ───────────────────────── habits (definitions) ─────────────────────────
create table if not exists public.habits (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  slug       text        not null,
  name       text        not null,
  icon       text,
  active     boolean     not null default true,
  sort       integer     not null default 0,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, slug)
);

alter table public.habits enable row level security;

create policy "habits_select_own" on public.habits
  for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits
  for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits
  for delete using (auth.uid() = user_id);

create index if not exists habits_user_updated_idx
  on public.habits (user_id, updated_at);

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- ───────────────────────── entries (date-keyed blobs) ─────────────────────────
-- entity in ('goals','habit_entries','health','mood'); date_key = 'YYYY-MM-DD'
create table if not exists public.entries (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  entity     text        not null,
  date_key   text        not null,
  payload    jsonb,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, entity, date_key),
  constraint entries_entity_chk
    check (entity in ('goals', 'habit_entries', 'health', 'mood'))
);

alter table public.entries enable row level security;

create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);
create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);

create index if not exists entries_user_entity_updated_idx
  on public.entries (user_id, entity, updated_at);

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ───────────────────────── realtime ─────────────────────────
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.habits;
alter publication supabase_realtime add table public.profiles;
