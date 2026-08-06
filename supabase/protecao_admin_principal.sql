-- ============================================================
-- OrácuLocaliza — Protege o Administrador principal (Junior)
-- Nenhum outro usuário (nem outro Administrador) pode alterar,
-- desativar, excluir ou resetar a senha do Junior. Só ele mesmo,
-- logado, pode alterar sua própria senha.
-- ============================================================

alter table profiles add column if not exists is_protected boolean not null default false;

update profiles set is_protected = true where username = 'Junior';

-- Atualiza as políticas de UPDATE e DELETE para respeitar a proteção
drop policy if exists "profiles_update_own_limited" on profiles;
create policy "profiles_update_own_limited" on profiles
  for update using (
    id = auth.uid()
    or (is_admin() and not coalesce(is_protected, false))
  );

drop policy if exists "profiles_delete_admin_only" on profiles;
create policy "profiles_delete_admin_only" on profiles
  for delete using (is_admin() and not coalesce(is_protected, false));

-- admin_clear_device precisa da mesma checagem (roda com privilégio elevado)
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
  if (select coalesce(is_protected, false) from profiles where id = p_user_id) then
    raise exception 'Este usuário é protegido e não pode ser alterado por outro administrador.';
  end if;
  update profiles set current_device_id = null, current_device_label = null where id = p_user_id;
end;
$$;
