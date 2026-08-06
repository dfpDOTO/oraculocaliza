// ============================================================
// OrácuLocaliza — Ações administrativas (usuários, permissões)
// Criar usuário: funciona com a anon key (via cliente descartável).
// Resetar senha de outro usuário: PRECISA de privilégio elevado,
// por isso chama a Edge Function `admin-reset-password` (ver
// supabase/functions/admin-reset-password/index.ts).
// ============================================================

import { supabase, createEphemeralClient, usernameToEmail } from './supabaseClient';
import { logAudit } from './authService';
import type { Profile } from './authService';

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminError';
  }
}

export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('username');
  if (error) throw new AdminError('Erro ao listar usuários: ' + error.message);
  return (data || []) as Profile[];
}

export async function createUser(username: string, role: Profile['role'], maxDevices = 2): Promise<void> {
  const clean = username.trim();
  if (!clean) throw new AdminError('Informe um nome de usuário.');

  const eph = createEphemeralClient();
  const email = usernameToEmail(clean);
  const { data, error } = await eph.auth.signUp({ email, password: '123456' });
  if (error || !data.user) {
    throw new AdminError(error?.message?.includes('already registered')
      ? 'Já existe um usuário com esse nome.'
      : 'Erro ao criar usuário: ' + (error?.message || 'desconhecido'));
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    username: clean,
    role,
    permissions: {},
    must_change_password: true,
    is_active: true,
    max_devices: Math.max(1, Math.min(10, maxDevices))
  });
  if (profileError) throw new AdminError('Usuário criado, mas houve erro ao salvar o perfil: ' + profileError.message);

  await eph.auth.signOut();
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

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw new AdminError('Erro ao excluir usuário: ' + error.message);
  await logAudit('admin_delete_user', { userId });
}

/**
 * Reseta a senha de outro usuário para "123456" e marca troca obrigatória.
 * Requer a Edge Function `admin-reset-password` publicada no Supabase
 * (usa privilégio de serviço, que nunca fica exposto no navegador).
 */
export async function resetUserPassword(userId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new AdminError('Sessão expirada.');

  const { error } = await supabase.functions.invoke('admin-reset-password', {
    body: { userId }
  });
  if (error) throw new AdminError('Erro ao resetar senha: ' + error.message);
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
