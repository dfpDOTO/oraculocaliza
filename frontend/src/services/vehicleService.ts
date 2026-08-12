// ============================================================
// OrácuLocaliza — Veículos
// Dados embutidos no app (rápido, sempre funciona). Para
// adicionar/editar veículos, peça ao Claude — ele atualiza este
// arquivo e publica uma nova versão do site.
// ============================================================

import vehiclesData from '../data/vehicles.json';
import type { Vehicle } from '../types';

const vehicles = vehiclesData as Vehicle[];

export async function ensureVehiclesLoaded(): Promise<void> {
  return Promise.resolve();
}
export async function refreshVehicles(): Promise<void> {
  return Promise.resolve();
}

export function searchVehicles(query: string): Vehicle[] {
  if (!query || query.trim().length === 0) return vehicles;
  const term = query.trim().toLowerCase();
  return vehicles.filter((v) => v.label.toLowerCase().includes(term)).slice(0, 15);
}

export function findVehicleByModel(model: string): Vehicle | null {
  return vehicles.find((v) => v.model.toLowerCase() === model.toLowerCase()) || null;
}

export function listAllVehicles(): Vehicle[] {
  return vehicles;
}
