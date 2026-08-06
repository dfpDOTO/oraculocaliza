// ============================================================
// OrácuLocaliza — Autenticação (login por usuário/senha)
// - Usa Supabase Auth por baixo dos panos (username -> e-mail interno)
// - Bloqueio após 5 tentativas erradas (10 min)
// - Múltiplos aparelhos por usuário (limite configurável pelo Admin)
// - Troca obrigatória de senha no primeiro acesso
// - Logout automático diário (verificado a cada carregamento do app)
// ============================================================

import { supabase, createEphemeralClient, usernameToEmail } from './supabaseClient';

export interface Profile {
  id: string;
  username: string;
  role: 'administrador' | 'supervisor' | 'operador';
  permissions: Record<string, boolean>;
  must_change_password: boolean;
  is_active: boolean;
  is_protected: boolean;
  max_devices: number;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const DEVICE_ID_KEY = 'oraculolocaliza:device-id';
const LAST_LOGIN_DATE_KEY = 'oraculolocaliza:last-login-date';

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iPhone/iPad' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Dispositivo';
  const browser = /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Navegador';
  return `${platform} · ${browser}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Verifica se já virou meia-noite desde o último login — se sim, desloga. */
export async function enforceDailyLogout(): Promise<void> {
  const last = localStorage.getItem(LAST_LOGIN_DATE_KEY);
  if (last && last !== todayStr()) {
    await supabase.auth.signOut();
    localStorage.removeItem(LAST_LOGIN_DATE_KEY);
  }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.session.user.id).single();
  if (error || !data) return null;
  return data as Profile;
}

/**
 * Garante que existe pelo menos um Administrador. Se o banco estiver
 * vazio (primeiro uso), cria "Junior" / senha "123456" automaticamente.
 */
export interface BootstrapResult {
  ok: boolean;
  reason?: string;
}

export async function bootstrapInitialAdmin(): Promise<BootstrapResult> {
  const { data: exists, error: checkError } = await supabase.rpc('admin_exists');
  if (checkError) {
    return { ok: false, reason: `Erro ao checar administradores: ${checkError.message}` };
  }
  if (exists) return { ok: true };

  const eph = createEphemeralClient();
  const email = usernameToEmail('Junior');
  const { data, error: signUpError } = await eph.auth.signUp({ email, password: '123456' });
  if (signUpError || !data.user) {
    return { ok: false, reason: `Falha ao criar o usuário inicial: ${signUpError?.message || 'motivo desconhecido'}` };
  }

  const { error: insertError } = await eph.from('profiles').insert({
    id: data.user.id,
    username: 'Junior',
    role: 'administrador',
    permissions: {},
    must_change_password: true,
    is_active: true,
    is_protected: true,
    max_devices: 2
  });

  await eph.auth.signOut();

  if (insertError) {
    return { ok: false, reason: `Usuário criado, mas falha ao salvar o perfil: ${insertError.message}` };
  }

  return { ok: true };
}

/**
 * Faz login E já valida tudo (ativo, dispositivo) antes de retornar.
 * IMPORTANTE: essa validação acontece toda AQUI DENTRO, de forma atômica,
 * para evitar a "tela piscando" — o AuthContext só reage ao resultado
 * final, nunca ao evento de login bruto do Supabase.
 */
export async function login(username: string, password: string): Promise<Profile> {
  const cleanUsername = username.trim();

  const { data: lockData } = await supabase.rpc('check_login_lockout', { p_username: cleanUsername });
  const lock = Array.isArray(lockData) ? lockData[0] : lockData;
  if (lock?.locked) {
    const until = lock.locked_until ? new Date(lock.locked_until) : null;
    const minutes = until ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000)) : 10;
    throw new AuthError(`Muitas tentativas incorretas. Tente novamente em ${minutes} minuto(s).`);
  }

  const email = usernameToEmail(cleanUsername);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await supabase.rpc('register_failed_login', { p_username: cleanUsername });

    const rawMessage = error?.message || '';
    const lower = rawMessage.toLowerCase();

    if (lower.includes('email not confirmed')) {
      throw new AuthError('Conta pendente de confirmação. Peça ao administrador para verificar as configurações de e-mail no Supabase (Confirm email deve estar desligado).');
    }
    if (lower.includes('invalid login credentials') || lower.includes('invalid') || rawMessage === '') {
      // Único caso em que mostramos a mensagem genérica de fato: usuário/senha errados.
      throw new AuthError('Usuário ou senha incorretos.');
    }
    // Qualquer outro motivo (rede, limite de tentativas do próprio Supabase, etc.)
    // mostra o motivo real em vez de mascarar como "senha incorreta" — isso
    // facilita muito diagnosticar problemas que não têm nada a ver com a senha.
    throw new AuthError(`Não foi possível entrar: ${rawMessage}`);
  }

  await supabase.rpc('reset_login_attempts', { p_username: cleanUsername });

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
  if (!profile) {
    await supabase.auth.signOut();
    throw new AuthError('Usuário sem perfil configurado. Contate o administrador.');
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new AuthError('Este usuário está desativado. Contate o administrador.');
  }

  const deviceId = getOrCreateDeviceId();
  const { data: deviceData, error: deviceError } = await supabase.rpc('check_and_register_device', {
    p_device_id: deviceId,
    p_device_label: getDeviceLabel()
  });

  if (deviceError) {
    await supabase.auth.signOut();
    throw new AuthError(`Erro ao registrar o aparelho: ${deviceError.message}`);
  }

  const deviceResult = Array.isArray(deviceData) ? deviceData[0] : deviceData;

  // Formato inesperado (ex: versão antiga da função no banco, que devolvia
  // só um booleano em vez de {allowed, reason}) — melhor avisar claramente
  // do que confundir com "usuário ou senha incorretos".
  if (deviceResult === null || deviceResult === undefined || typeof deviceResult !== 'object') {
    await supabase.auth.signOut();
    throw new AuthError('Não foi possível verificar o limite de aparelhos (função do banco desatualizada). Peça ao administrador para rodar novamente o script de múltiplos aparelhos no Supabase.');
  }

  if (!deviceResult.allowed) {
    await supabase.auth.signOut();
    throw new AuthError(deviceResult.reason || 'Limite de aparelhos conectados atingido para este usuário.');
  }

  localStorage.setItem(LAST_LOGIN_DATE_KEY, todayStr());

  await logAudit('login', { username: cleanUsername });

  return profile as Profile;
}

export async function logout(): Promise<void> {
  const profile = await getCurrentProfile();
  await supabase.auth.signOut();
  localStorage.removeItem(LAST_LOGIN_DATE_KEY);
  if (profile) await logAudit('logout', { username: profile.username });
}

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

export function validatePassword(password: string): string | null {
  if (!PASSWORD_RULE.test(password)) {
    return 'A senha precisa ter no mínimo 6 caracteres, incluindo 1 letra maiúscula, 1 número e 1 caractere especial.';
  }
  return null;
}

export async function changeOwnPassword(newPassword: string): Promise<void> {
  const validationError = validatePassword(newPassword);
  if (validationError) throw new AuthError(validationError);

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new AuthError('Não foi possível alterar a senha: ' + error.message);

  const { data: session } = await supabase.auth.getSession();
  if (session.session) {
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', session.session.user.id);
    await logAudit('change_password', {});
  }
}

export async function logAudit(action: string, details: Record<string, unknown>): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const profile = session.session ? await supabase.from('profiles').select('username').eq('id', session.session.user.id).single() : null;
    await supabase.from('audit_log').insert({
      user_id: session.session?.user.id ?? null,
      username: profile?.data?.username ?? details.username ?? null,
      action,
      details
    });
  } catch {
    // auditoria nunca deve travar o fluxo principal do app
  }
}
