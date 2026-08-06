// ============================================================
// OrácuLocaliza — Ajuste fino de localização (CDBRI / Posto)
// A geocodificação por endereço às vezes "estima" um ponto na
// via principal em vez do local exato. Este serviço permite ao
// Administrador travar a coordenada exata (lat/lng) para os
// pontos fixos da rota — vale para todos os usuários, pois fica
// salvo no banco (app_settings), não só no aparelho de quem ajustou.
// ============================================================

import { supabase } from './supabaseClient';
import type { LatLng } from '../types';

export type OverrideKey = 'cdbri_location' | 'posto_location';

export async function getLocationOverride(key: OverrideKey): Promise<LatLng | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error || !data) return null;
  const value = data.value as any;
  if (typeof value?.lat === 'number' && typeof value?.lng === 'number') {
    return { lat: value.lat, lng: value.lng };
  }
  return null;
}

export async function setLocationOverride(key: OverrideKey, location: LatLng | null): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const { error } = await supabase.from('app_settings').upsert({
    key,
    value: location ?? {}, // {} = sem ajuste (a coluna não aceita NULL)
    updated_by: session.session?.user.id ?? null,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error('Erro ao salvar localização: ' + error.message);
}
