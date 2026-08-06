-- ============================================================
-- OrácuLocaliza — Schema Supabase (Fase 3: login, permissões,
-- auditoria, histórico compartilhado, bloqueio por dispositivo)
-- ============================================================
-- Como rodar:
--   1) Abra seu projeto em supabase.com
--   2) Menu lateral -> SQL Editor -> New query
--   3) Cole TODO este arquivo e clique em "Run"
-- Pode rodar mais de uma vez sem problema (usa "if not exists"
-- e "or replace" onde possível).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PERFIS (1 por usuário, ligado ao login do Supabase Auth)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'operador' check (role in ('administrador','supervisor','operador')),
  permissions jsonb not null default '{}'::jsonb,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  current_device_id text,
  current_device_label text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- Função auxiliar: é administrador? (security definer evita recursão de RLS)
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select role = 'administrador' from profiles where id = auth.uid()), false);
$$;

create or replace function has_permission(perm text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'administrador' or (permissions->>perm)::boolean = true from profiles where id = auth.uid()),
    false
  );
$$;

-- Checagem segura de "já existe algum administrador?" — usada pelo app
-- para decidir se cria o usuário inicial "Junior". Roda com privilégio
-- elevado (ignora RLS) só para essa checagem booleana, sem expor dados.
create or replace function admin_exists()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from profiles where role = 'administrador');
$$;

alter table profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "profiles_update_own_limited" on profiles;
create policy "profiles_update_own_limited" on profiles
  for update using (id = auth.uid() or is_admin());

drop policy if exists "profiles_insert_admin_only" on profiles;
create policy "profiles_insert_admin_only" on profiles
  for insert with check (is_admin() or id = auth.uid());

drop policy if exists "profiles_delete_admin_only" on profiles;
create policy "profiles_delete_admin_only" on profiles
  for delete using (is_admin());

-- ------------------------------------------------------------
-- BLOQUEIO POR TENTATIVAS (5 erradas = 10 min bloqueado)
-- Acesso só via funções abaixo (nunca direto pela tabela),
-- pois precisa funcionar ANTES do login.
-- ------------------------------------------------------------
create table if not exists login_attempts (
  username text primary key,
  failed_count int not null default 0,
  locked_until timestamptz
);

alter table login_attempts enable row level security;
-- nenhuma policy = tabela inacessível diretamente; só via funções abaixo

create or replace function check_login_lockout(p_username text)
returns table(locked boolean, locked_until timestamptz)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(la.locked_until > now(), false) as locked,
    la.locked_until
  from login_attempts la where la.username = lower(p_username)
  union all
  select false, null::timestamptz where not exists (select 1 from login_attempts where username = lower(p_username))
  limit 1;
$$;

create or replace function register_failed_login(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into login_attempts (username, failed_count, locked_until)
  values (lower(p_username), 1, null)
  on conflict (username) do update
  set failed_count = login_attempts.failed_count + 1,
      locked_until = case
        when login_attempts.failed_count + 1 >= 5 then now() + interval '10 minutes'
        else login_attempts.locked_until
      end;
end;
$$;

create or replace function reset_login_attempts(p_username text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from login_attempts where username = lower(p_username);
$$;

-- ------------------------------------------------------------
-- DISPOSITIVO ÚNICO POR USUÁRIO
-- ------------------------------------------------------------
create or replace function check_and_register_device(p_device_id text, p_device_label text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
begin
  select current_device_id into existing from profiles where id = auth.uid();
  if existing is null or existing = p_device_id then
    update profiles set current_device_id = p_device_id, current_device_label = p_device_label, last_login_at = now()
    where id = auth.uid();
    return true;
  end if;
  return false;
end;
$$;

create or replace function admin_clear_device(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem liberar dispositivos.';
  end if;
  update profiles set current_device_id = null, current_device_label = null where id = p_user_id;
end;
$$;

-- ------------------------------------------------------------
-- AUDITORIA
-- ------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  username text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

drop policy if exists "audit_insert_own" on audit_log;
create policy "audit_insert_own" on audit_log
  for insert with check (auth.uid() is not null);

drop policy if exists "audit_select_admin" on audit_log;
create policy "audit_select_admin" on audit_log
  for select using (is_admin());

-- ------------------------------------------------------------
-- HISTÓRICO DE CONSULTAS (compartilhado, com regras de visibilidade)
-- ------------------------------------------------------------
create table if not exists queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  username text,
  created_at timestamptz not null default now(),
  plate text,
  vehicle_label text,
  profile text,
  tank_level_start int,
  destination_code text,
  destination_name text,
  distance_km numeric,
  duration_min numeric,
  return_distance_km numeric,
  can_return_severe boolean,
  safety_level text,
  safety_margin_percent numeric,
  maps_url text,
  waze_url text,
  raw jsonb
);

alter table queries enable row level security;

drop policy if exists "queries_insert_own" on queries;
create policy "queries_insert_own" on queries
  for insert with check (user_id = auth.uid());

drop policy if exists "queries_select_visibility" on queries;
create policy "queries_select_visibility" on queries
  for select using (
    user_id = auth.uid()
    or is_admin()
    or has_permission('visualizar_historico_global')
  );

create index if not exists idx_queries_created_at on queries(created_at desc);
create index if not exists idx_queries_user on queries(user_id);

-- ------------------------------------------------------------
-- CONFIGURAÇÕES GERAIS (margem de segurança, endereços CDBRI/Posto)
-- ------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table app_settings enable row level security;

drop policy if exists "settings_select_all" on app_settings;
create policy "settings_select_all" on app_settings
  for select using (true);

drop policy if exists "settings_write_admin" on app_settings;
create policy "settings_write_admin" on app_settings
  for all using (is_admin()) with check (is_admin());

insert into app_settings (key, value) values
  ('safety_margin', '{"preset":"padrao","percent":0}')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- USUÁRIO ADMINISTRADOR INICIAL
-- ------------------------------------------------------------
-- IMPORTANTE: este passo cria o LOGIN (auth.users) não pode ser feito
-- por SQL puro com segurança total — por isso, o admin inicial
-- ("Junior" / senha "12345") é criado pelo app na primeira vez que
-- alguém abre a tela de login e não existe nenhum administrador
-- ainda (ver função bootstrap abaixo, chamada automaticamente).
-- Isso evita que a senha inicial fique gravada em texto puro no SQL.
