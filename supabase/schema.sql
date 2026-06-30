-- ============================================================
-- SCHEMA INICIAL — Ferramentas Unificadas Krambeck
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard
-- ============================================================

-- Extensão para UUIDs (já vem ativa no Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES — dados extras dos usuários (além do auth.users)
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('admin', 'user')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: usuário só lê/edita o próprio perfil; admin lê todos
alter table public.profiles enable row level security;

create policy "Usuário lê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuário atualiza o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admin lê todos os perfis"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Trigger: cria profile automaticamente após signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- AI_ANALYSES — histórico de análises feitas via GROQ
-- ============================================================
create table public.ai_analyses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  prompt      text not null,
  result      text not null,
  model       text not null default 'llama-3.3-70b-versatile',
  created_at  timestamptz not null default now()
);

alter table public.ai_analyses enable row level security;

create policy "Usuário gerencia suas análises"
  on public.ai_analyses for all
  using (auth.uid() = user_id);

-- Índice para busca por usuário
create index ai_analyses_user_id_idx on public.ai_analyses(user_id);

-- ============================================================
-- TOOLS — ferramentas cadastradas na plataforma
-- ============================================================
create table public.tools (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  slug        text not null unique,
  icon        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.tools enable row level security;

create policy "Qualquer usuário autenticado lê ferramentas ativas"
  on public.tools for select
  using (auth.role() = 'authenticated' and active = true);

-- ============================================================
-- USER_TOOL_ACCESS — quais ferramentas cada usuário pode usar
-- ============================================================
create table public.user_tool_access (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tool_id    uuid not null references public.tools(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

alter table public.user_tool_access enable row level security;

create policy "Usuário vê seus próprios acessos"
  on public.user_tool_access for select
  using (auth.uid() = user_id);
