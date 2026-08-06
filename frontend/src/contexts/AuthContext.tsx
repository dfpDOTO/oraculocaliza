import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { getCurrentProfile, enforceDailyLogout, bootstrapInitialAdmin, logout as authLogout } from '../services/authService';
import { flushPendingQueries } from '../services/historyService';
import type { Profile } from '../services/authService';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  bootstrapError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const refreshProfile = async () => {
    const p = await getCurrentProfile();
    setProfile(p);
  };

  useEffect(() => {
    (async () => {
      const result = await bootstrapInitialAdmin();
      if (!result.ok) setBootstrapError(result.reason || 'Erro desconhecido ao preparar o sistema.');
      await enforceDailyLogout();
      await refreshProfile();
      setLoading(false);
    })();

    // IMPORTANTE: ignoramos o evento "SIGNED_IN" aqui de propósito. O fluxo
    // de login() em authService.ts já faz toda a validação (ativo, limite de
    // aparelhos) e só then chama refreshProfile() manualmente quando tudo
    // passou. Se reagíssemos também aqui a esse evento bruto, a tela piscava
    // "logado" por uma fração de segundo antes da validação terminar, e caso
    // ela reprovasse o login, a tela voltava sozinha pro login sem mostrar
    // o motivo (o erro ficava "preso" numa instância antiga do componente).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') return;
      refreshProfile();
    });

    // verifica virada de dia a cada minuto (logout diário automático)
    const interval = setInterval(() => {
      enforceDailyLogout();
    }, 60 * 1000);

    // Histórico resiliente: tenta sincronizar consultas que não foram salvas
    // na hora (rede instável, etc.) — ao abrir o app, a cada 30s, e sempre
    // que a conexão com a internet voltar. Garante que nenhuma previsão
    // gerada fique perdida só no navegador do operador.
    flushPendingQueries();
    const syncInterval = setInterval(() => {
      flushPendingQueries();
    }, 30 * 1000);
    const handleOnline = () => flushPendingQueries();
    window.addEventListener('online', handleOnline);

    return () => {
      listener.subscription.unsubscribe();
      clearInterval(interval);
      clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const signOut = async () => {
    await authLogout();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, bootstrapError, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
