// ============================================================
// OrácuLocaliza — Geocodificação via Google Maps (Geocoder)
// Cache agressivo em localStorage: o mesmo endereço nunca é
// geocodificado duas vezes, reduzindo custo de API (item 5).
// ============================================================

import { loadGoogleMaps } from './googleMapsLoader';
import type { LatLng } from '../types';

const CACHE_KEY = 'oraculolocaliza:geocode-cache:v3-google';

function readCache(): Record<string, LatLng> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, LatLng>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage indisponível/cheio — segue sem cache
  }
}

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

function withoutCep(address: string): string {
  return address.replace(/,?\s*\d{5}-?\d{3}\s*$/, '');
}

async function tryGeocode(geocoder: any, query: string): Promise<LatLng | null> {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: query, region: 'br' }, (results: any[], status: string) => {
      if (status === 'OK' && results && results.length > 0) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else if (status === 'ZERO_RESULTS') {
        resolve(null);
      } else {
        reject(new GeocodingError(`Google Geocoding retornou erro: ${status}`));
      }
    });
  });
}

/**
 * Converte um endereço em coordenadas (lat/lng) usando o Google Geocoder.
 * Resultados são cacheados no navegador — o mesmo endereço nunca é geocodificado duas vezes.
 */
export async function geocodeAddress(address: string): Promise<LatLng> {
  const cache = readCache();
  if (cache[address]) return cache[address];

  await loadGoogleMaps();
  const geocoder = new (window as any).google.maps.Geocoder();

  let result = await tryGeocode(geocoder, address);
  if (!result) {
    // fallback: tenta sem o CEP, caso o número/CEP exato não esteja indexado
    result = await tryGeocode(geocoder, withoutCep(address));
  }

  if (!result) {
    throw new GeocodingError(`Endereço não encontrado pelo Google Maps: "${address}".`);
  }

  writeCache({ ...readCache(), [address]: result });
  return result;
}
