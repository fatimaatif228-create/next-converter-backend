create table if not exists public.users (
  id uuid primary key default auth.uid(),
  created_at timestamptz default now(),
  email text unique,
  name text,
  role text default 'user'
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  owner_id uuid references public.users(id),
  name text unique
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references public.users(id),
  org_id uuid references public.organizations(id),
  name text unique,
  status text
);

create table if not exists public.conversions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid references public.projects(id),
  status text
);

create table if not exists public.conversion_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  conversion_id uuid references public.conversions(id),
  message text,
  status text
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references public.users(id),
  org_id uuid references public.organizations(id),
  role text,
  unique (user_id, org_id)
);



alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.conversions enable row level security;
alter table public.conversion_logs enable row level security;
alter table public.team_members enable row level security;


drop policy if exists "select own projects" on public.projects;
drop policy if exists "insert own projects" on public.projects;
drop policy if exists "update own projects" on public.projects;


create policy "select own projects"
on public.projects
for select
using (auth.uid() = user_id);

create policy "insert own projects"
on public.projects
for insert
with check (auth.uid() = user_id);

create policy "update own projects"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);