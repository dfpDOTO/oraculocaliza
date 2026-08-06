// ============================================================
// OrácuLocaliza — Lojas/destinos
// Dados embutidos no app (rápido, sempre funciona, sem depender
// de nenhum banco de dados externo estar configurado). Para
// adicionar/editar lojas, peça ao Claude — ele atualiza este
// arquivo e publica uma nova versão do site.
// ============================================================

import storesData from '../data/stores.json';
import type { Store } from '../types';

const stores = storesData as Store[];

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalize(str: string): string {
  return stripAccents(str || '').toLowerCase();
}

interface IndexedStore {
  store: Store;
  terms: string[];
}

const index: IndexedStore[] = stores.map((store) => {
  const rawCode = normalize(store.code);
  const shortCode = rawCode.replace(/^vc/, '');
  const terms = Array.from(
    new Set(
      [rawCode, shortCode, normalize(store.name), normalize(store.neighborhood), normalize(store.zone)].filter(Boolean)
    )
  );
  return { store, terms };
});

// Mantidos por compatibilidade com quem chama (App.tsx, autocompletes) —
// como os dados já vêm embutidos no app, não há nada assíncrono a esperar.
export async function ensureStoresLoaded(): Promise<void> {
  return Promise.resolve();
}
export async function refreshStores(): Promise<void> {
  return Promise.resolve();
}

export function searchStores(query: string): Store[] {
  if (!query || query.trim().length === 0) return [];
  const term = normalize(query.trim());

  return index
    .map((entry) => {
      const bestTermIndex = entry.terms.findIndex((t) => t.startsWith(term));
      if (bestTermIndex === -1) {
        const containsIndex = entry.terms.findIndex((t) => t.includes(term));
        if (containsIndex === -1) return null;
        return { entry, score: 100 + entry.terms[containsIndex].length };
      }
      return { entry, score: entry.terms[bestTermIndex].length };
    })
    .filter((x): x is { entry: IndexedStore; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map((x) => x.entry.store);
}

export function findStoreByCode(code: string): Store | null {
  if (!code) return null;
  const target = normalize(code);
  return stores.find((s) => normalize(s.code) === target) || null;
}

export function listAllStores(): Store[] {
  return stores;
}
