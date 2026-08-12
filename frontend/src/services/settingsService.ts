// ============================================================
// OrácuLocaliza — Margem de Segurança Operacional
// Configuração administrativa que soma uma reserva extra aos
// cálculos de consumo, para representar condições reais de uso
// (ar-condicionado, trânsito, variações entre veículos) além do
// consumo oficial do fabricante.
//
// Por enquanto fica salva no navegador (localStorage). Quando o
// login/admin (Fase 3) estiver pronto, este ajuste passa a ficar
// restrito ao Administrador e sincronizado no banco (Supabase).
// ============================================================

export type MarginPreset = 'conservadora' | 'padrao' | 'severa' | 'personalizada';

export interface SafetyMarginSettings {
  preset: MarginPreset;
  percent: number; // 0-50
}

const STORAGE_KEY = 'oraculolocaliza:safety-margin:v1';

export const MARGIN_PRESETS: Record<Exclude<MarginPreset, 'personalizada'>, number> = {
  conservadora: 15,
  padrao: 0,
  severa: 25
};

const DEFAULT_SETTINGS: SafetyMarginSettings = { preset: 'padrao', percent: 0 };

export function getSafetyMarginSettings(): SafetyMarginSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (typeof parsed.percent !== 'number' || parsed.percent < 0 || parsed.percent > 50) return DEFAULT_SETTINGS;
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSafetyMarginSettings(settings: SafetyMarginSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // se o storage estiver indisponível, a configuração simplesmente não persiste
  }
}

export function setSafetyMarginPreset(preset: Exclude<MarginPreset, 'personalizada'>): SafetyMarginSettings {
  const settings: SafetyMarginSettings = { preset, percent: MARGIN_PRESETS[preset] };
  setSafetyMarginSettings(settings);
  return settings;
}

export function setSafetyMarginCustomPercent(percent: number): SafetyMarginSettings {
  const clamped = Math.max(0, Math.min(50, percent));
  const settings: SafetyMarginSettings = { preset: 'personalizada', percent: clamped };
  setSafetyMarginSettings(settings);
  return settings;
}
