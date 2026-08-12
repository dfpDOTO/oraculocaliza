// ============================================================
// OrácuLocaliza — Carregador da Google Maps JavaScript API
// Usada para geocodificação (Geocoder), rotas (DirectionsService)
// e mapa interativo — tudo client-side, sem backend, sem CORS
// (diferente das APIs REST cruas de Directions/Geocoding, que
// não funcionam direto do navegador).
// ============================================================

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve();
  }
  if (!API_KEY) {
    return Promise.reject(new Error('Chave do Google Maps não configurada (VITE_GOOGLE_MAPS_API_KEY).'));
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=geometry&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar a Google Maps JavaScript API. Verifique a chave e as APIs ativadas no Google Cloud.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
