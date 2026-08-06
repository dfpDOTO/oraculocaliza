-- ============================================================
-- OrácuLocaliza — Múltiplos aparelhos por usuário (configurável)
-- Substitui a trava de "1 aparelho só" por um limite configurável
-- por usuário (padrão: 2), definido pelo Administrador.
-- ============================================================

alter table profiles add column if not exists max_devices int not null default 2;
alter table profiles add column if not exists is_protected boolean not null default false;
update profiles set is_protected = true where username = 'Junior';

create table if not exists user_devices (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  device_id text not null,
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table user_devices enable row level security;

drop policy if exists "devices_select_own_or_admin" on user_devices;
create policy "devices_select_own_or_admin" on user_devices
  for select using (user_id = auth.uid() or is_admin());
-- escritas só pelas funções abaixo (nunca direto pela tabela)

-- Checa/registra o aparelho atual. Retorna se foi permitido e o motivo, se não.
drop function if exists check_and_register_device(text, text);
create or replace function check_and_register_device(p_device_id text, p_device_label text)
returns table(allowed boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_count int;
  v_exists boolean;
begin
  select coalesce(max_devices, 2) into v_max from profiles where id = auth.uid();

  select exists(select 1 from user_devices where user_id = auth.uid() and device_id = p_device_id) into v_exists;

  if v_exists then
    update user_devices set last_seen_at = now(), device_label = p_device_label
    where user_id = auth.uid() and device_id = p_device_id;
    return query select true, null::text;
    return;
  end if;

  select count(*) into v_count from user_devices where user_id = auth.uid();

  if v_count >= v_max then
    return query select false, format('Limite de %s aparelho(s) conectado(s) atingido para este usuário.', v_max);
    return;
  end if;

  insert into user_devices (user_id, device_id, device_label) values (auth.uid(), p_device_id, p_device_label);
  return query select true, null::text;
end;
$$;

-- Lista os aparelhos de um usuário (o próprio usuário ou um administrador podem ver)
create or replace function admin_list_devices(p_user_id uuid)
returns setof user_devices
language sql
security definer
set search_path = public
as $$
  select * from user_devices
  where user_id = p_user_id and (is_admin() or p_user_id = auth.uid())
  order by last_seen_at desc;
$$;

-- Remove um aparelho específico (o dono sempre pode remover o próprio;
-- administrador pode remover de outros, exceto de usuários protegidos)
create or replace function remove_user_device(p_device_row_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_protected boolean;
begin
  select user_id into v_owner from user_devices where id = p_device_row_id;

  if v_owner = auth.uid() then
    delete from user_devices where id = p_device_row_id;
    return;
  end if;

  if not is_admin() then
    raise exception 'Sem permissão para remover este aparelho.';
  end if;

  select coalesce(is_protected, false) into v_protected from profiles where id = v_owner;
  if v_protected then
    raise exception 'Este usuário é protegido — só ele mesmo pode remover seus aparelhos.';
  end if;

  delete from user_devices where id = p_device_row_id;
end;
$$;

-- Define quantos aparelhos um usuário pode conectar (só Junior/administrador,
-- exceto para si mesmo, que qualquer um pode ajustar)
create or replace function admin_set_max_devices(p_user_id uuid, p_max int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> auth.uid() and not is_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_user_id <> auth.uid() and (select coalesce(is_protected, false) from profiles where id = p_user_id) then
    raise exception 'Este usuário é protegido.';
  end if;
  update profiles set max_devices = greatest(1, least(10, p_max)) where id = p_user_id;
end;
$$;

drop function if exists admin_clear_device(uuid);
