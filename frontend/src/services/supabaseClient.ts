// ============================================================
// OrácuLocaliza — Cliente Supabase
// A "anon key" é pública por natureza (assim como a chave do
// Google Maps) — a segurança real vem das políticas de RLS
// (Row Level Security) configuradas no banco (ver supabase/schema.sql).
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'oraculolocaliza-auth'
  }
});

/**
 * Cliente "descartável", sem persistir sessão — usado só quando o
 * Administrador cria um novo usuário, para que o cadastro (que faz
 * login automático no Supabase Auth) não derrube a sessão do admin
 * que está logado no `supabase` principal.
 */
export function createEphemeralClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// E-mail interno usado pelo Supabase Auth (o usuário só vê/digita o "username")
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@oraculolocaliza.local`;
}
