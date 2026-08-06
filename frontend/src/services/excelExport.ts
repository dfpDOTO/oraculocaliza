// ============================================================
// OrácuLocaliza — Exportação para Excel (.xlsx) no navegador
// Usa a biblioteca SheetJS (xlsx). Como não há mais servidor,
// o arquivo "AAAA-MM-DD.xlsx" é gerado sob demanda e baixado
// diretamente pelo navegador — o botão "Baixar Excel do dia"
// sempre gera o arquivo com as consultas daquele dia.
// ============================================================

import * as XLSX from 'xlsx';
import type { PredictionResult } from '../types';

const HEADERS = [
  'Data', 'Hora', 'Placa', 'Modelo', 'Perfil',
  'Tanque na chegada ao posto', 'Litros abastecidos', 'Combustível abastecido',
  'Tanque inicial (partida)',
  'Origem', 'Via', 'Destino', 'Código', 'Distância ida (km)', 'Tempo ida (min)',
  'Litros pessimista', 'Litros médio', 'Litros otimista',
  'Chegada pessimista (/8)', 'Chegada média (/8)', 'Chegada otimista (/8)',
  'Distância volta (km)', 'Litros necessários volta (méd.)', 'Consegue voltar (méd.)?',
  'Google Maps', 'Waze'
];

function toRow(q: PredictionResult): (string | number)[] {
  const d = new Date(q.createdAt);
  return [
    d.toLocaleDateString('pt-BR'),
    d.toLocaleTimeString('pt-BR'),
    q.plate || '-',
    q.vehicle.label,
    q.profile,
    `${q.refuelInfo?.arrivalTankBeforeRefuel ?? '-'}/8`,
    q.refuelInfo?.litersRefueled ?? '-',
    q.refuelInfo?.fuelType ?? '-',
    `${q.tankLevelStart}/8`,
    q.origin.code,
    q.waypoint?.code || '-',
    q.destination.name,
    q.destination.code,
    q.route.distanceKm,
    q.route.durationMin,
    q.fuel.liters.pessimistic,
    q.fuel.liters.medium,
    q.fuel.liters.optimistic,
    `${q.fuel.arrivalTankEighths.pessimistic}/8`,
    `${q.fuel.arrivalTankEighths.medium}/8`,
    `${q.fuel.arrivalTankEighths.optimistic}/8`,
    q.returnTrip?.distanceKm ?? '-',
    q.returnTrip?.litersNeeded?.medium ?? '-',
    q.returnTrip ? (q.returnTrip.canReturn.medium ? 'Sim' : 'Não') : '-',
    q.mapsUrl,
    q.wazeUrl
  ];
}

export function exportQueriesToExcel(queries: PredictionResult[], fileName: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...queries.map(toRow)]);
  worksheet['!cols'] = HEADERS.map(() => ({ wch: 20 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consultas');

  XLSX.writeFile(workbook, fileName);
}

export function todayFileName(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}.xlsx`;
}
