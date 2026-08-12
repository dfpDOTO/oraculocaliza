// ============================================================
// OrácuLocaliza — Roteirização via Google Maps DirectionsService
// (Maps JavaScript API) com trânsito em tempo real.
//
// HISTÓRICO DE DIAGNÓSTICO (mantido em comentário para referência):
// 1ª tentativa: Google Routes API (routes.googleapis.com) via fetch()
//   direto do navegador. Muito provavelmente bloqueada por CORS, já
//   que essa API REST não foi desenhada para chamadas diretas do
//   browser sem um backend — não temos servidor neste projeto.
// 2ª causa encontrada: o Directions API clássico (usado abaixo) tem
//   uma limitação conhecida e documentada: "duration_in_traffic" nem
//   sempre é retornado quando a requisição tem PONTOS DE PARADA
//   (waypoints) no meio do trajeto — que é exatamente o nosso caso
//   (CDBRI -> Posto -> Destino sempre tem 1 parada no meio).
// SOLUÇÃO: em vez de 1 requisição com waypoint, fazemos 2 requisições
// separadas (CDBRI->Posto e Posto->Destino), cada uma SEM waypoint,
// que é o cenário em que o Google consegue retornar trânsito ao vivo
// de forma confiável. Depois somamos distância/tempo e juntamos os
// dois trajetos no mapa.
// ============================================================

import { loadGoogleMaps } from './googleMapsLoader';
import type { LatLng, RouteInfo } from '../types';

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingError';
  }
}

interface LegResult {
  distanceMeters: number;
  durationSeconds: number;
  hasTraffic: boolean;
  geometry: LatLng[];
}

async function requestSingleLeg(origin: LatLng, destination: LatLng): Promise<LegResult> {
  await loadGoogleMaps();
  const google = (window as any).google;
  const directionsService = new google.maps.DirectionsService();

  const request = {
    origin,
    destination,
    travelMode: google.maps.TravelMode.DRIVING,
    avoidTolls: true,
    drivingOptions: {
      departureTime: new Date(), // "agora" -> pede trânsito ao vivo
      trafficModel: google.maps.TrafficModel.BEST_GUESS
    }
  };

  const response: any = await new Promise((resolve, reject) => {
    directionsService.route(request, (result: any, status: string) => {
      if (status === 'OK') resolve(result);
      else reject(new RoutingError(`Google Directions retornou erro: ${status}`));
    });
  });

  const route = response.routes[0];
  const leg = route.legs[0];
  const hasTraffic = leg.duration_in_traffic?.value != null;

  return {
    distanceMeters: leg.distance.value,
    durationSeconds: hasTraffic ? leg.duration_in_traffic.value : leg.duration.value,
    hasTraffic,
    geometry: route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }))
  };
}

/**
 * Calcula uma rota passando por 2 ou mais pontos, na ordem fornecida,
 * evitando pedágios e usando trânsito em tempo real. Cada trecho entre
 * dois pontos consecutivos é pedido separadamente ao Google (sem usar
 * o parâmetro "waypoints"), pois é assim que o trânsito ao vivo é
 * retornado de forma confiável.
 */
export async function calculateRoute(waypoints: LatLng[]): Promise<RouteInfo> {
  if (waypoints.length < 2) {
    throw new RoutingError('É necessário ao menos origem e destino para calcular uma rota.');
  }

  const legs: LegResult[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const leg = await requestSingleLeg(waypoints[i], waypoints[i + 1]);
    legs.push(leg);
  }

  const distanceMeters = legs.reduce((sum, l) => sum + l.distanceMeters, 0);
  const durationSeconds = legs.reduce((sum, l) => sum + l.durationSeconds, 0);
  const usedRealTimeTraffic = legs.every((l) => l.hasTraffic);
  const geometry = legs.flatMap((l) => l.geometry);

  return {
    distanceKm: round2(distanceMeters / 1000),
    durationMin: round2(durationSeconds / 60),
    geometry,
    usedRealTimeTraffic
  };
}

/**
 * Versão cacheada de uma única perna de rota — usada para o trecho
 * CDBRI -> Posto, que é SEMPRE o mesmo (os dois pontos são fixos).
 * Recalcular isso via API a cada previsão seria desperdício de chamadas
 * (estamos dentro da cota gratuita do Google e precisamos economizar).
 * Guarda o resultado por 20 minutos — tempo suficiente para ainda
 * capturar variações de trânsito ao longo do dia, mas evitando uma
 * chamada nova a cada previsão gerada.
 */
const FIXED_LEG_CACHE_KEY = 'oraculolocaliza:fixed-leg-cache:v1';
const FIXED_LEG_TTL_MS = 20 * 60 * 1000;

export async function calculateCachedLeg(origin: LatLng, destination: LatLng, cacheKey: string): Promise<RouteInfo> {
  try {
    const raw = localStorage.getItem(FIXED_LEG_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.cachedAt < FIXED_LEG_TTL_MS) {
      return cached.result;
    }
  } catch {
    // segue sem cache se der algum problema de leitura
  }

  const leg = await requestSingleLeg(origin, destination);
  const result: RouteInfo = {
    distanceKm: round2(leg.distanceMeters / 1000),
    durationMin: round2(leg.durationSeconds / 60),
    geometry: leg.geometry,
    usedRealTimeTraffic: leg.hasTraffic
  };

  try {
    const raw = localStorage.getItem(FIXED_LEG_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[cacheKey] = { result, cachedAt: Date.now() };
    localStorage.setItem(FIXED_LEG_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // se não conseguir salvar o cache, não é grave — só perde a economia dessa vez
  }

  return result;
}

/** Combina 2 ou mais trechos de rota já calculados em um resultado único. */
export function mergeRouteInfos(legs: RouteInfo[]): RouteInfo {
  return {
    distanceKm: round2(legs.reduce((sum, l) => sum + l.distanceKm, 0)),
    durationMin: round2(legs.reduce((sum, l) => sum + l.durationMin, 0)),
    geometry: legs.flatMap((l) => l.geometry),
    usedRealTimeTraffic: legs.every((l) => l.usedRealTimeTraffic !== false)
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
