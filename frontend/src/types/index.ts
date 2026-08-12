export interface Store {
  code: string;
  name: string;
  reference: string;
  address: string;
  fullAddress: string;
  neighborhood: string;
  zone: string;
  city: string;
  state: string;
}

export interface Vehicle {
  id: number;
  brand: string;
  model: string;
  label: string;
  fuelType: string;
  tankCapacityLiters: number;
  consumptionUrban: number;
  consumptionRoad: number;
  consumptionEthanol: number;
}

export type Profile = 'Econômico' | 'Moderado' | 'Alto consumo';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  geometry: LatLng[]; // já decodificado, pronto para o Leaflet
  usedRealTimeTraffic?: boolean;
}

export interface FuelPrediction {
  liters: { pessimistic: number; medium: number; optimistic: number };
  arrivalTankEighths: { pessimistic: number; medium: number; optimistic: number };
  arrivalLiters: { pessimistic: number; medium: number; optimistic: number };
  tankCapacity: number;
  fuelType: string;
  warnings: string[];
}

export interface ReturnTripInfo {
  distanceKm: number;
  durationMin: number;
  geometry: LatLng[];
  litersNeeded: { pessimistic: number; medium: number; optimistic: number };
  canReturn: { pessimistic: boolean; medium: boolean; optimistic: boolean };
  arrivalBackTankEighths: { pessimistic: number; medium: number; optimistic: number };
}

export interface SafetyIndicatorInfo {
  level: 'green' | 'yellow' | 'red';
  label: string;
  message: string;
}

export interface RefuelInfo {
  arrivalTankBeforeRefuel: number; // 0-8, nível ao chegar no posto, antes de abastecer
  litersRefueled: number;
  fuelType: 'Etanol' | 'Gasolina' | 'Diesel' | 'Gasolina + Diesel';
}

export interface PredictionResult {
  id: string;
  createdAt: string; // ISO
  username?: string;
  refuelInfo: RefuelInfo;
  origin: { code: string; name: string; address: string; location: LatLng };
  waypoint: { code: string; name: string; address: string; location: LatLng };
  destination: Store & { location: LatLng };
  vehicle: Vehicle;
  plate: string | null;
  profile: Profile;
  tankLevelStart: number;
  route: RouteInfo;
  fuel: FuelPrediction;
  returnTrip: ReturnTripInfo;
  safetyIndicator: SafetyIndicatorInfo;
  safetyMarginPercent: number;
  mapsUrl: string;
  wazeUrl: string;
}

export interface DashboardData {
  queriesToday: number;
  kmToday: number;
  litersToday: number;
  topDestination: string;
  topModel: string;
  lastQuery: PredictionResult | null;
}

export interface HistoryFilters {
  plate?: string;
  model?: string;
  destination?: string;
  date?: string;
  hour?: string;
}
