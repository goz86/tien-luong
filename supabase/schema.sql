create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  school text,
  region text not null default 'Seoul - Hongdae',
  intro text,
  interests text[] not null default '{}',
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  label text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  hourly_wage integer not null,
  night_bonus boolean not null default false,
  overtime_bonus boolean not null default false,
  holiday_bonus boolean not null default false,
  weekly_allowance boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  school text,
  region text not null,
  intro text not null,
  tags text[] not null default '{}',
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete set null,
  target_profile_id uuid not null references public.friend_profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, target_profile_id)
);

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null,
  target text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  unique (base, target)
);

alter table public.profiles enable row level security;
alter table public.work_shifts enable row level security;
alter table public.friend_profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.exchange_rates enable row level security;

create policy "Profiles are readable when visible"
  on public.profiles for select
  using (is_visible = true or auth.uid() = id);

create policy "Users manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage own shifts"
  on public.work_shifts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Visible friend profiles are public"
  on public.friend_profiles for select
  using (is_visible = true);

create policy "Users manage own friend profile"
  on public.friend_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated users create friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = requester_id);

create policy "Users read related friend requests"
  on public.friend_requests for select
  using (
    auth.uid() = requester_id
    or exists (
      select 1 from public.friend_profiles fp
      where fp.id = target_profile_id and fp.user_id = auth.uid()
    )
  );

create policy "Exchange rates are readable"
  on public.exchange_rates for select
  using (true);
