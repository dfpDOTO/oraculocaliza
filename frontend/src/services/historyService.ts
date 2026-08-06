// ============================================================
// OrácuLocaliza — Histórico de consultas (Supabase, compartilhado)
// Substitui o localStorage: agora o histórico fica no banco,
// com regras de visibilidade por usuário (RLS):
//   - Administrador: vê tudo
//   - Operador: vê só o próprio
//   - Supervisor: vê conforme a permissão "visualizar_historico_global"
//
// RESILIÊNCIA: se o salvamento falhar (rede instável, etc.), a consulta
// NUNCA é descartada — ela entra numa fila local (localStorage) e o
// sistema tenta sincronizar automaticamente (ao reabrir o app, a cada
// 30s, e sempre que a conexão voltar), até confirmar que foi salva.
// ============================================================

import { supabase } from './supabaseClient';
import { getCurrentProfile } from './authService';
import { logAudit } from './authService';
import type { PredictionResult, DashboardData, HistoryFilters } from '../types';

const PENDING_QUEUE_KEY = 'oraculolocaliza:pending-queries:v1';

function readPendingQueue(): PredictionResult[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePendingQueue(items: PredictionResult[]) {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(items));
  } catch {
    // se nem o localStorage estiver disponível, não há mais nada a fazer localmente
  }
}

function enqueuePending(result: PredictionResult) {
  const queue = readPendingQueue();
  if (!queue.some((q) => q.id === result.id)) {
    queue.push(result);
    writePendingQueue(queue);
  }
}

function dequeuePending(id: string) {
  writePendingQueue(readPendingQueue().filter((q) => q.id !== id));
}

export function getPendingQueueCount(): number {
  return readPendingQueue().length;
}

export function isPendingSync(id: string): boolean {
  return readPendingQueue().some((q) => q.id === id);
}

/** Tenta gravar uma consulta direto no Supabase. Lança erro se falhar (sem fila). */
async function insertQuery(result: PredictionResult): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Usuário não autenticado.');

  const resultWithUser: PredictionResult = { ...result, username: result.username || profile.username };

  const { error } = await supabase.from('queries').upsert({
    id: result.id,
    user_id: profile.id,
    username: resultWithUser.username,
    created_at: result.createdAt,
    plate: result.plate,
    vehicle_label: result.vehicle.label,
    profile: result.profile,
    tank_level_start: result.tankLevelStart,
    destination_code: result.destination.code,
    destination_name: result.destination.name,
    distance_km: result.route.distanceKm,
    duration_min: result.route.durationMin,
    return_distance_km: result.returnTrip.distanceKm,
    can_return_severe: result.returnTrip.canReturn.pessimistic,
    safety_level: result.safetyIndicator.level,
    safety_margin_percent: result.safetyMarginPercent,
    maps_url: result.mapsUrl,
    waze_url: result.wazeUrl,
    raw: resultWithUser
  });

  if (error) throw new Error('Erro ao salvar consulta: ' + error.message);

  await logAudit('create_query', {
    destination: result.destination.code,
    vehicle: result.vehicle.label,
    safety: result.safetyIndicator.level
  });
}

export type SaveOutcome = 'saved' | 'queued';

/**
 * Salva a consulta assim que a previsão é gerada — SEMPRE, sem depender de
 * nenhum botão. Tenta gravar direto; se falhar (rede, instabilidade), a
 * consulta é colocada numa fila local e sincronizada automaticamente depois,
 * garantindo que nenhuma previsão gerada seja perdida.
 */
export async function saveQuery(result: PredictionResult): Promise<SaveOutcome> {
  try {
    await insertQuery(result);
    dequeuePending(result.id);
    return 'saved';
  } catch (err) {
    console.error('Falha ao salvar consulta — entrando na fila local para nova tentativa:', err);
    enqueuePending(result);
    return 'queued';
  }
}

/**
 * Tenta sincronizar todas as consultas pendentes (chamado ao abrir o app,
 * periodicamente, e quando a conexão volta). Silencioso: só loga no console.
 */
export async function flushPendingQueries(): Promise<void> {
  const queue = readPendingQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      await insertQuery(item);
      dequeuePending(item.id);
    } catch (err) {
      console.warn('Ainda não foi possível sincronizar consulta pendente:', item.id, err);
      // mantém na fila e tenta de novo na próxima chamada
    }
  }
}

function rowToResult(row: any): PredictionResult {
  return row.raw as PredictionResult;
}

function mergeWithPending(synced: PredictionResult[]): PredictionResult[] {
  const pending = readPendingQueue();
  if (pending.length === 0) return synced;
  const syncedIds = new Set(synced.map((s) => s.id));
  const onlyPending = pending.filter((p) => !syncedIds.has(p.id));
  return [...onlyPending, ...synced].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getAllQueries(limit = 200): Promise<PredictionResult[]> {
  const { data, error } = await supabase
    .from('queries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('Erro ao carregar histórico: ' + error.message);
  return mergeWithPending((data || []).map(rowToResult));
}

export async function searchHistory(filters: HistoryFilters): Promise<PredictionResult[]> {
  let query = supabase.from('queries').select('*').order('created_at', { ascending: false }).limit(200);

  if (filters.plate) query = query.ilike('plate', `%${filters.plate}%`);
  if (filters.model) query = query.ilike('vehicle_label', `%${filters.model}%`);
  if (filters.destination) {
    query = query.or(`destination_code.ilike.%${filters.destination}%,destination_name.ilike.%${filters.destination}%`);
  }
  if (filters.date) {
    query = query.gte('created_at', `${filters.date}T00:00:00`).lte('created_at', `${filters.date}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Erro ao pesquisar histórico: ' + error.message);

  let results = mergeWithPending((data || []).map(rowToResult));

  // aplica os mesmos filtros também às pendentes (que não passaram pela query do banco)
  if (filters.plate) results = results.filter((q) => (q.plate || '').toLowerCase().includes(filters.plate!.toLowerCase()));
  if (filters.model) results = results.filter((q) => q.vehicle.label.toLowerCase().includes(filters.model!.toLowerCase()));
  if (filters.destination) {
    const term = filters.destination.toLowerCase();
    results = results.filter((q) => q.destination.code.toLowerCase().includes(term) || q.destination.name.toLowerCase().includes(term));
  }
  if (filters.date) results = results.filter((q) => isSameLocalDay(q.createdAt, filters.date!));

  // filtro de hora é feito no cliente (hora local do navegador)
  if (filters.hour) {
    const hourStr = String(filters.hour).padStart(2, '0');
    results = results.filter((q) => String(new Date(q.createdAt).getHours()).padStart(2, '0') === hourStr);
  }

  return results;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isSameLocalDay(iso: string, dateStr: string): boolean {
  const d = new Date(iso);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return local === dateStr;
}

export async function getQueriesByDate(dateStr: string): Promise<PredictionResult[]> {
  return searchHistory({ date: dateStr });
}

export async function getDashboardData(): Promise<DashboardData> {
  const today = todayStr();
  const todayQueries = await getQueriesByDate(today);
  const all = await getAllQueries(1);

  const kmToday = todayQueries.reduce((sum, q) => sum + q.route.distanceKm, 0);
  const litersToday = todayQueries.reduce((sum, q) => sum + q.fuel.liters.medium, 0);

  const destCounts = new Map<string, { name: string; code: string; count: number }>();
  for (const q of todayQueries) {
    const key = q.destination.code;
    const existing = destCounts.get(key);
    if (existing) existing.count += 1;
    else destCounts.set(key, { name: q.destination.name, code: q.destination.code, count: 1 });
  }
  let topDestination = '-';
  let topDestCount = 0;
  for (const v of destCounts.values()) {
    if (v.count > topDestCount) {
      topDestCount = v.count;
      topDestination = `${v.name} (${v.code})`;
    }
  }

  const modelCounts = new Map<string, number>();
  for (const q of todayQueries) {
    modelCounts.set(q.vehicle.label, (modelCounts.get(q.vehicle.label) || 0) + 1);
  }
  let topModel = '-';
  let topModelCount = 0;
  for (const [label, count] of modelCounts.entries()) {
    if (count > topModelCount) {
      topModelCount = count;
      topModel = label;
    }
  }

  return {
    queriesToday: todayQueries.length,
    kmToday: round2(kmToday),
    litersToday: round2(litersToday),
    topDestination,
    topModel,
    lastQuery: all[0] || null
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
