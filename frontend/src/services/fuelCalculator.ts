import type { Vehicle, Profile, FuelPrediction } from '../types';

export const PROFILE_MULTIPLIERS: Record<Profile, number> = {
  'Econômico': 1.12,
  'Moderado': 1.0,
  'Alto consumo': 0.82
};

// ============================================================
// Cenários de consumo (item "Previsão em diferentes cenários")
// - optimistic  = Cenário Econômico: A/C desligado, trânsito normal, condução econômica
// - medium      = Operação Normal: uso moderado de A/C, trânsito comum, condução normal
// - pessimistic = Condição Severa: A/C ligado o tempo todo, trânsito intenso, condução severa
//
// Os nomes internos (pessimistic/medium/optimistic) foram mantidos para não
// quebrar histórico/Excel já existentes — só a apresentação na tela usa os
// novos nomes (Econômico / Operação Normal / Condição Severa).
// ============================================================
const SCENARIO_EFFICIENCY = {
  optimistic: 1.10,  // Cenário Econômico
  medium: 1.0,       // Operação Normal
  pessimistic: 0.80  // Condição Severa (A/C ligado + trânsito intenso + condução severa)
};

interface CalcParams {
  distanceKm: number;
  vehicle: Vehicle;
  profile: Profile;
  tankLevelStart: number; // 0..8
  /** Margem de Segurança Operacional (%), 0-50. Reduz a autonomia efetiva em todos os cenários. */
  safetyMarginPercent?: number;
}

export function calculateFuelPrediction({ distanceKm, vehicle, profile, tankLevelStart, safetyMarginPercent = 0 }: CalcParams): FuelPrediction {
  const multiplier = PROFILE_MULTIPLIERS[profile] ?? 1.0;
  const baseKmPerL = vehicle.consumptionEthanol;
  const tankCapacity = vehicle.tankCapacityLiters;
  const marginFactor = 1 - Math.max(0, Math.min(50, safetyMarginPercent)) / 100;

  const effectiveKmPerL = baseKmPerL * multiplier * marginFactor;

  const kmPerLPessimista = effectiveKmPerL * SCENARIO_EFFICIENCY.pessimistic;
  const kmPerLMedio = effectiveKmPerL * SCENARIO_EFFICIENCY.medium;
  const kmPerLOtimista = effectiveKmPerL * SCENARIO_EFFICIENCY.optimistic;

  const litersPessimista = distanceKm / kmPerLPessimista;
  const litersMedio = distanceKm / kmPerLMedio;
  const litersOtimista = distanceKm / kmPerLOtimista;

  const litersInicial = (tankLevelStart / 8) * tankCapacity;

  const toEighths = (litersRestantes: number) => {
    const eighths = Math.round((litersRestantes / tankCapacity) * 8);
    return Math.max(0, Math.min(8, eighths));
  };

  const restPess = litersInicial - litersPessimista;
  const restMed = litersInicial - litersMedio;
  const restOti = litersInicial - litersOtimista;

  return {
    liters: {
      pessimistic: round2(litersPessimista),
      medium: round2(litersMedio),
      optimistic: round2(litersOtimista)
    },
    arrivalTankEighths: {
      pessimistic: toEighths(restPess),
      medium: toEighths(restMed),
      optimistic: toEighths(restOti)
    },
    arrivalLiters: {
      pessimistic: round2(Math.max(0, restPess)),
      medium: round2(Math.max(0, restMed)),
      optimistic: round2(Math.max(0, restOti))
    },
    tankCapacity,
    fuelType: 'Etanol',
    warnings: buildWarnings(restPess, tankCapacity)
  };
}

function buildWarnings(litersRestantesPessimista: number, tankCapacity: number): string[] {
  const warnings: string[] = [];
  if (litersRestantesPessimista < 0) {
    warnings.push('Atenção: na Condição Severa o veículo pode ficar sem combustível antes de chegar ao destino. Reabasteça antes de partir.');
  } else if (litersRestantesPessimista / tankCapacity < 0.125) {
    warnings.push('Nível de combustível estimado na chegada (Condição Severa) está muito baixo (abaixo de 1/8). Considere reabastecer no trajeto.');
  }
  return warnings;
}

interface ReturnCalcParams {
  returnDistanceKm: number;
  vehicle: Vehicle;
  profile: Profile;
  arrivalLitersAtDestination: { pessimistic: number; medium: number; optimistic: number };
  safetyMarginPercent?: number;
}

/**
 * Calcula o trecho de volta (Destino -> CDBRI), SEM reabastecimento no destino.
 * Parte do combustível restante estimado na chegada (por cenário) e verifica
 * se é suficiente para o retorno.
 */
export function calculateReturnTrip({ returnDistanceKm, vehicle, profile, arrivalLitersAtDestination, safetyMarginPercent = 0 }: ReturnCalcParams) {
  const multiplier = PROFILE_MULTIPLIERS[profile] ?? 1.0;
  const baseKmPerL = vehicle.consumptionEthanol;
  const tankCapacity = vehicle.tankCapacityLiters;
  const marginFactor = 1 - Math.max(0, Math.min(50, safetyMarginPercent)) / 100;
  const effectiveKmPerL = baseKmPerL * multiplier * marginFactor;

  const scenarios = ['pessimistic', 'medium', 'optimistic'] as const;
  const kmPerLByScenario = {
    pessimistic: effectiveKmPerL * SCENARIO_EFFICIENCY.pessimistic,
    medium: effectiveKmPerL * SCENARIO_EFFICIENCY.medium,
    optimistic: effectiveKmPerL * SCENARIO_EFFICIENCY.optimistic
  };

  const litersNeeded: Record<string, number> = {};
  const canReturn: Record<string, boolean> = {};
  const arrivalBackTankEighths: Record<string, number> = {};

  for (const scenario of scenarios) {
    const needed = returnDistanceKm / kmPerLByScenario[scenario];
    litersNeeded[scenario] = round2(needed);

    const availableAtDestination = arrivalLitersAtDestination[scenario];
    const remainingAfterReturn = availableAtDestination - needed;
    canReturn[scenario] = remainingAfterReturn >= 0;

    const eighths = Math.round((Math.max(0, remainingAfterReturn) / tankCapacity) * 8);
    arrivalBackTankEighths[scenario] = Math.max(0, Math.min(8, eighths));
  }

  return {
    litersNeeded: litersNeeded as { pessimistic: number; medium: number; optimistic: number },
    canReturn: canReturn as { pessimistic: boolean; medium: boolean; optimistic: boolean },
    arrivalBackTankEighths: arrivalBackTankEighths as { pessimistic: number; medium: number; optimistic: number }
  };
}

export type SafetyLevel = 'green' | 'yellow' | 'red';

export interface SafetyIndicator {
  level: SafetyLevel;
  label: string;
  message: string;
}

/**
 * Indicador visual de segurança (🟢🟡🔴), baseado no cenário mais severo
 * (Condição Severa = "pessimistic"):
 *  - 🔴 não mantém reserva mínima ao chegar, OU não consegue retornar ao CDBRI
 *  - 🟡 consegue ida + volta, mas com pouca margem (menos de 1/8 sobrando no retorno)
 *  - 🟢 combustível confortável mesmo no cenário severo, ida e volta
 */
export function computeSafetyIndicator(
  fuel: FuelPrediction,
  returnCanReturnSevere: boolean,
  arrivalBackTankEighthsSevere: number
): SafetyIndicator {
  const severeArrivalOk = fuel.arrivalLiters.pessimistic > 0 && fuel.arrivalTankEighths.pessimistic >= 1;

  if (!severeArrivalOk || !returnCanReturnSevere) {
    return {
      level: 'red',
      label: 'Risco alto',
      message: 'Na Condição Severa, o veículo pode não manter a reserva mínima ao chegar ou não conseguir retornar ao Centro de Desativação sem reabastecer.'
    };
  }

  if (arrivalBackTankEighthsSevere < 1) {
    return {
      level: 'yellow',
      label: 'Margem baixa',
      message: 'A viagem é viável mesmo na Condição Severa, mas com pouca margem de segurança (menos de 1/8 de tanque ao retornar).'
    };
  }

  return {
    level: 'green',
    label: 'Margem segura',
    message: 'Combustível suficiente mesmo considerando a Condição Severa, com folga tanto na ida quanto no retorno.'
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
