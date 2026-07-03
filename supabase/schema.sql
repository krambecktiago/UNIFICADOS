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

-- ============================================================
-- USER_TOOL_SETTINGS — parâmetros de formulário por ferramenta
-- Execute esta migração no SQL Editor do Supabase após o schema inicial
-- ============================================================
create table public.user_tool_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tool_slug  text not null,
  settings   jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, tool_slug)
);

alter table public.user_tool_settings enable row level security;

create policy "Usuário gerencia suas configurações de ferramentas"
  on public.user_tool_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- MIGRAÇÃO: Admin + Controle de Acesso por Ferramenta
-- Execute no SQL Editor do Supabase após o schema inicial
-- ============================================================

-- Função is_admin() sem recursão (security definer bypassa RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Substituir política recursiva por versão segura
drop policy if exists "Admin lê todos os perfis" on public.profiles;

create policy "Admin lê todos os perfis"
  on public.profiles for select
  using (public.is_admin());

create policy "Admin atualiza qualquer perfil"
  on public.profiles for update
  using (public.is_admin());

-- Admin gerencia todos os acessos às ferramentas
create policy "Admin gerencia acessos de ferramentas"
  on public.user_tool_access for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed das 6 ferramentas da plataforma
insert into public.tools (name, slug, description) values
  ('Conferir Duplicatas', 'duplicatas', 'Compara retorno bancário com fluxo de caixa do ERP'),
  ('Seguro de Vida', 'seguro-vida', 'Cruza PDF do seguro com planilha de funcionários'),
  ('Contas a Pagar', 'contas-pagar', 'Envia resumo diário de pagamentos para o Discord'),
  ('Comparador DDA', 'comparador-dda', 'Cruza boletos DDA com duplicatas de Contas a Pagar'),
  ('Conciliação Cartão', 'conciliacao-cartao', 'Cruza vendas no cartão com duplicatas em aberto'),
  ('Conciliação Bancária', 'comparar-extrato', 'Cruza extrato ERP com extrato Viacredi e identifica divergências')
on conflict (slug) do nothing;

-- ============================================================
-- MIGRAÇÃO: Registro de Uso das Ferramentas (tool_usage_logs)
-- Execute no SQL Editor do Supabase após o schema inicial
-- Alimenta os cards de "Arquivos analisados" e "Ferramentas mais
-- usadas" do Dashboard, com dados de toda a empresa
-- ============================================================
create table public.tool_usage_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tool_slug   text not null,
  files_count integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.tool_usage_logs enable row level security;

-- Qualquer usuário autenticado pode ler os registros — os números
-- exibidos no Dashboard são agregados da empresa toda, não só do usuário
create policy "Usuário autenticado lê registros de uso"
  on public.tool_usage_logs for select
  using (auth.role() = 'authenticated');

-- Cada usuário só registra uso em nome de si mesmo
create policy "Usuário registra seu próprio uso"
  on public.tool_usage_logs for insert
  with check (auth.uid() = user_id);

create index tool_usage_logs_tool_slug_idx on public.tool_usage_logs(tool_slug);

-- ============================================================
-- MIGRAÇÃO: Controle de Acesso às Telas (Dashboard/Configurações)
-- Execute no SQL Editor do Supabase após o schema inicial
-- Reaproveita a tabela "tools" + "user_tool_access" já usada para
-- as 6 ferramentas: cada tela vira uma "ferramenta" liberável por
-- usuário no painel de Administração. Admin sempre tem acesso total
-- (bypass já existente em requireToolAccess). Usuários já cadastrados
-- começam SEM acesso — libere manualmente no painel de Admin.
-- ============================================================
insert into public.tools (name, slug, description) values
  ('Dashboard', 'dashboard', 'Tela inicial com acesso rápido e estatísticas de uso'),
  ('Configurações', 'configuracoes', 'Dados da própria conta')
on conflict (slug) do nothing;

-- A tela "Análise IA" (slug 'ia') foi removida do produto — se você já
-- executou a migração anterior em produção, pode limpar o residuo com:
-- delete from public.user_tool_access where tool_id in (select id from public.tools where slug = 'ia');
-- delete from public.tools where slug = 'ia';

-- Função reutilizável: usuário tem acesso à ferramenta <slug>?
-- (mesmo espírito do is_admin(), evita repetir o exists(...) em cada policy)
create or replace function public.has_tool_access(tool_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_tool_access uta
    join public.tools t on t.id = uta.tool_id
    where uta.user_id = auth.uid() and t.slug = tool_slug
  );
$$;

-- As ferramentas "Conciliação PIX" (Bradesco + ERP JJW), "Comparador DDA" e
-- "Conciliação Cartão" foram removidas do produto (nunca chegaram a
-- processar dados reais — tabelas vazias). Se você já executou a migração
-- do PIX em produção, limpe o resíduo com:
-- drop table if exists public.pix_reconciliation_log;
-- drop table if exists public.pix_transactions;
-- delete from public.user_tool_access where tool_id in (select id from public.tools where slug in ('pix', 'comparador-dda', 'conciliacao-cartao'));
-- delete from public.tools where slug in ('pix', 'comparador-dda', 'conciliacao-cartao');
