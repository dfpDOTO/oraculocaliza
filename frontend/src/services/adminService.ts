// ============================================================
// OrácuLocaliza — Ações administrativas (usuários, permissões)
//
// Criar, excluir e resetar senha de usuário exigem privilégio
// elevado (o navegador nunca deve ter esse poder diretamente) —
// por isso as três chamam a Edge Function `admin-manage-user`
// (ver supabase/functions/admin-manage-user/index.ts), que
// PRECISA estar publicada no Supabase para essas 3 ações funcionarem.
// ============================================================

import { supabase } from './supabaseClient';
import { logAudit } from './authService';
import type { Profile } from './authService';

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminError';
  }
}

async function callManageUser(body: Record<string, unknown>): Promise<any> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new AdminError('Sessão expirada.');

  const { data, error } = await supabase.functions.invoke('admin-manage-user', { body });

  if (error) {
    // Erro de rede/infra (função não publicada, etc.) — mensagem clara em vez de "Failed to fetch"
    throw new AdminError(
      'Não foi possível executar a ação administrativa. Verifique se a Edge Function "admin-manage-user" está publicada no Supabase. Detalhe técnico: ' + error.message
    );
  }
  if (data?.error) {
    throw new AdminError(data.error);
  }
  return data;
}

export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('username');
  if (error) throw new AdminError('Erro ao listar usuários: ' + error.message);
  return (data || []) as Profile[];
}

export async function createUser(username: string, role: Profile['role'], maxDevices = 2): Promise<void> {
  const clean = username.trim();
  if (!clean) throw new AdminError('Informe um nome de usuário.');

  await callManageUser({ action: 'create_user', username: clean, role, maxDevices });
  await logAudit('admin_create_user', { username: clean, role, maxDevices });
}

export async function updateUserRole(userId: string, role: Profile['role']): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new AdminError('Erro ao alterar papel: ' + error.message);
  await logAudit('admin_update_role', { userId, role });
}

export async function updateUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId);
  if (error) throw new AdminError('Erro ao alterar status: ' + error.message);
  await logAudit(isActive ? 'admin_activate_user' : 'admin_deactivate_user', { userId });
}

export async function updateUserPermissions(userId: string, permissions: Record<string, boolean>): Promise<void> {
  const { error } = await supabase.from('profiles').update({ permissions }).eq('id', userId);
  if (error) throw new AdminError('Erro ao alterar permissões: ' + error.message);
  await logAudit('admin_update_permissions', { userId, permissions });
}

export interface DeviceRow {
  id: number;
  user_id: string;
  device_id: string;
  device_label: string | null;
  last_seen_at: string;
  created_at: string;
}

export async function setMaxDevices(userId: string, maxDevices: number): Promise<void> {
  const { error } = await supabase.rpc('admin_set_max_devices', { p_user_id: userId, p_max: maxDevices });
  if (error) throw new AdminError('Erro ao definir limite de aparelhos: ' + error.message);
  await logAudit('admin_set_max_devices', { userId, maxDevices });
}

export async function listUserDevices(userId: string): Promise<DeviceRow[]> {
  const { data, error } = await supabase.rpc('admin_list_devices', { p_user_id: userId });
  if (error) throw new AdminError('Erro ao listar aparelhos: ' + error.message);
  return (data || []) as DeviceRow[];
}

export async function removeDevice(deviceRowId: number): Promise<void> {
  const { error } = await supabase.rpc('remove_user_device', { p_device_row_id: deviceRowId });
  if (error) throw new AdminError('Erro ao remover aparelho: ' + error.message);
  await logAudit('remove_device', { deviceRowId });
}

/**
 * Exclui o usuário DE VERDADE — login (auth) e perfil juntos.
 * (Antes só apagava o perfil, deixando o login "fantasma" — por
 * isso reconstruir um usuário com o mesmo nome dava erro de
 * "já existe". Agora usa privilégio elevado via Edge Function.)
 */
export async function deleteUser(userId: string): Promise<void> {
  await callManageUser({ action: 'delete_user', userId });
  await logAudit('admin_delete_user', { userId });
}

/**
 * Reseta a senha de outro usuário para "123456" e marca troca obrigatória.
 */
export async function resetUserPassword(userId: string): Promise<void> {
  await callManageUser({ action: 'reset_password', userId });
  await logAudit('admin_reset_password', { userId });
}

export interface AuditLogRow {
  id: number;
  user_id: string | null;
  username: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export async function listAuditLog(limit = 100): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new AdminError('Erro ao carregar auditoria: ' + error.message);
  return (data || []) as AuditLogRow[];
}
