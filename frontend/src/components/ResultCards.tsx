import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Divider, Button, Chip, Stack,
  Snackbar, Alert
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import FlagCircleIcon from '@mui/icons-material/FlagCircle';
import RouteIcon from '@mui/icons-material/Route';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BatterySaverIcon from '@mui/icons-material/BatterySaver';
import MapIcon from '@mui/icons-material/Map';
import DirectionsIcon from '@mui/icons-material/Directions';
import NavigationIcon from '@mui/icons-material/Navigation';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UTurnLeftIcon from '@mui/icons-material/UTurnLeft';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MapView from './MapView';
import type { PredictionResult } from '../types';
import type { SaveOutcome } from '../services/historyService';
import { formatEighths } from '../utils/format';

const SAFETY_META = {
  green: { emoji: '🟢', color: '#3ED17E', bg: 'rgba(62,209,126,0.12)' },
  yellow: { emoji: '🟡', color: '#FFB020', bg: 'rgba(255,176,32,0.12)' },
  red: { emoji: '🔴', color: '#FF5A5F', bg: 'rgba(255,90,95,0.12)' }
} as const;

/**
 * Contorno luminoso do card "Tanque na chegada por cenário":
 *   🟢 verde   -> chega com 2/8 ou mais em TODOS os cenários
 *   🟡 amarelo -> chega com 2/8+ em ALGUNS cenários, mas não em todos
 *   🔴 vermelho -> não chega com 2/8 em NENHUM cenário
 */
function getTankArrivalGlow(arrivalTankEighths: { pessimistic: number; medium: number; optimistic: number }) {
  const values = [arrivalTankEighths.optimistic, arrivalTankEighths.medium, arrivalTankEighths.pessimistic];
  const countAtOrAbove2 = values.filter((v) => v >= 2).length;

  if (countAtOrAbove2 === values.length) return SAFETY_META.green;
  if (countAtOrAbove2 === 0) return SAFETY_META.red;
  return SAFETY_META.yellow;
}

interface Props {
  result: PredictionResult;
  saveStatus?: SaveOutcome | null;
}

function eighths(n: number) {
  return formatEighths(n);
}

export default function ResultCards({ result, saveStatus }: Props) {
  const [copied, setCopied] = useState(false);

  const { origin, waypoint, destination, route, fuel, returnTrip, mapsUrl, wazeUrl, vehicle, profile, plate, safetyIndicator, safetyMarginPercent, refuelInfo } = result;

  const summaryText = buildSummaryText(result);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
  };

  const anyReturnRisk = !returnTrip.canReturn.pessimistic || !returnTrip.canReturn.medium;

  return (
    <Box className="fade-in-up" sx={{ mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Resultado da Previsão</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {saveStatus === 'queued' ? (
          <Box component="span" sx={{ color: 'warning.main' }}>
            ⚠ Não foi possível salvar no histórico agora — a consulta foi guardada neste aparelho e será sincronizada automaticamente assim que possível (inclusive se você fechar e reabrir o app).
          </Box>
        ) : (
          'Consulta salva automaticamente no histórico.'
        )}
        {safetyMarginPercent > 0 ? ` Margem de segurança operacional aplicada: +${safetyMarginPercent}%.` : ''}
      </Typography>

      <Card
        sx={{
          mb: 2.5,
          borderColor: SAFETY_META[safetyIndicator.level].color,
          borderWidth: 1.5,
          borderStyle: 'solid',
          bgcolor: SAFETY_META[safetyIndicator.level].bg
        }}
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: 40, lineHeight: 1 }}>{SAFETY_META[safetyIndicator.level].emoji}</Typography>
          <Box>
            <Typography variant="h6" sx={{ color: SAFETY_META[safetyIndicator.level].color }}>
              {safetyIndicator.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">{safetyIndicator.message}</Typography>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        {/* Card 1 — Origem (com trecho via Posto) */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <CardHeader icon={<PlaceIcon />} title="Origem" />
              <Typography variant="h6">{origin.code} — {origin.name}</Typography>
              <Typography variant="body2" color="text.secondary">{origin.address}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Passa por
              </Typography>
              <Typography variant="body2">{waypoint.name}</Typography>
              <Typography variant="caption" color="text.secondary">{waypoint.address}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Abastecimento no posto
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 1 }}>
                <Chip size="small" label={`Chegou com ${formatEighths(refuelInfo.arrivalTankBeforeRefuel)}`} />
                <Chip size="small" label={`Abasteceu ${refuelInfo.litersRefueled} L`} />
                <Chip size="small" color={refuelInfo.fuelType === 'Etanol' ? 'default' : 'warning'} label={refuelInfo.fuelType} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2 — Destino */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <CardHeader icon={<FlagCircleIcon />} title="Destino" />
              <Typography variant="h6">{destination.code} — {destination.name}</Typography>
              <Typography variant="body2" color="text.secondary">{destination.fullAddress || destination.address}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {destination.neighborhood && <Chip size="small" label={destination.neighborhood} />}
                {destination.reference && <Chip size="small" label={destination.reference} />}
                {destination.zone && <Chip size="small" color="primary" variant="outlined" label={destination.zone} />}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3 — Distância (ida, CDBRI->Posto->Destino) */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<RouteIcon />} label="Distância (ida)" value={`${route.distanceKm} km`} />
        </Grid>

        {/* Card 4 — Tempo previsto */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<ScheduleIcon />}
            label="Tempo previsto (ida)"
            value={formatMinutes(route.durationMin)}
            note={route.usedRealTimeTraffic === false ? 'Trânsito em tempo real indisponível para este trecho' : 'Com trânsito em tempo real'}
          />
        </Grid>

        {/* Card 5 — Consumo previsto nos 3 cenários */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <CardHeader icon={<LocalGasStationIcon />} title="Consumo previsto por cenário" />
              <ScenarioRows3
                econLabel="Cenário Econômico"
                econSub="A/C desligado · trânsito normal · condução econômica"
                econValue={`${fuel.liters.optimistic} L`}
                normalLabel="Operação Normal"
                normalSub="A/C moderado · trânsito comum · condução normal"
                normalValue={`${fuel.liters.medium} L`}
                severeLabel="Condição Severa"
                severeSub="A/C ligado · trânsito intenso · condução severa"
                severeValue={`${fuel.liters.pessimistic} L`}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Card 6 — Tanque na chegada nos 3 cenários */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              border: `1.5px solid ${getTankArrivalGlow(fuel.arrivalTankEighths).color}`,
              boxShadow: `0 0 14px 1px ${getTankArrivalGlow(fuel.arrivalTankEighths).color}66`
            }}
          >
            <CardContent>
              <CardHeader icon={<BatterySaverIcon />} title="Tanque na chegada por cenário" />
              <ScenarioRows3
                econLabel="Cenário Econômico"
                econSub="A/C desligado · trânsito normal · condução econômica"
                econValue={eighths(fuel.arrivalTankEighths.optimistic)}
                normalLabel="Operação Normal"
                normalSub="A/C moderado · trânsito comum · condução normal"
                normalValue={eighths(fuel.arrivalTankEighths.medium)}
                severeLabel="Condição Severa"
                severeSub="A/C ligado · trânsito intenso · condução severa"
                severeValue={eighths(fuel.arrivalTankEighths.pessimistic)}
              />
            </CardContent>
          </Card>
        </Grid>

        {fuel.warnings.length > 0 && (
          <Grid item xs={12}>
            {fuel.warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ mb: 1 }}>{w}</Alert>
            ))}
          </Grid>
        )}

        {/* Card — Trecho de volta / risco de recusa */}
        <Grid item xs={12}>
          <Card sx={{ borderColor: anyReturnRisk ? 'warning.main' : undefined, borderWidth: anyReturnRisk ? 1.5 : undefined, borderStyle: anyReturnRisk ? 'solid' : undefined }}>
            <CardContent>
              <CardHeader icon={<UTurnLeftIcon />} title="Trecho de volta (Destino → CDBRI, sem reabastecer)" />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">Distância de volta</Typography>
                  <Typography variant="h6">{returnTrip.distanceKm} km · {formatMinutes(returnTrip.durationMin)}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Combustível necessário</Typography>
                  <ScenarioRows
                    pessimistic={`${returnTrip.litersNeeded.pessimistic} L`}
                    medium={`${returnTrip.litersNeeded.medium} L`}
                    optimistic={`${returnTrip.litersNeeded.optimistic} L`}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Tanque estimado no retorno</Typography>
                  <ScenarioRows
                    pessimistic={returnTrip.canReturn.pessimistic ? eighths(returnTrip.arrivalBackTankEighths.pessimistic) : '—'}
                    medium={returnTrip.canReturn.medium ? eighths(returnTrip.arrivalBackTankEighths.medium) : '—'}
                    optimistic={returnTrip.canReturn.optimistic ? eighths(returnTrip.arrivalBackTankEighths.optimistic) : '—'}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                {anyReturnRisk ? (
                  <Alert severity="warning" icon={<WarningAmberIcon />}>
                    Combustível pode não ser suficiente para o retorno ao CDBRI sem reabastecer
                    {!returnTrip.canReturn.pessimistic && !returnTrip.canReturn.medium ? ' (Condição Severa e Operação Normal)' : ' (Condição Severa)'}.
                    Isso não significa que o veículo foi recusado — apenas que, em caso de recusa no destino, será necessário abastecer antes de retornar.
                  </Alert>
                ) : (
                  <Alert severity="success" icon={<CheckCircleIcon />}>
                    Combustível suficiente para o retorno ao CDBRI em todos os cenários, sem necessidade de reabastecer.
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card — Mapa */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <CardHeader icon={<MapIcon />} title="Mapa da rota de ida (Google Maps)" />
              <MapView
                origin={origin.location}
                waypoint={waypoint.location}
                destination={destination.location}
                geometry={route.geometry}
                originLabel={origin.name}
                waypointLabel={waypoint.name}
                destinationLabel={destination.name}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Card — Navegação */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <CardHeader icon={<DirectionsIcon />} title="Navegar" />
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  startIcon={<MapIcon />}
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no Google Maps
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<NavigationIcon />}
                  href={wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no Waze
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Card — Copiar resultado */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <CardHeader icon={<ContentCopyIcon />} title="Copiar resultado" />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Copia todos os dados da previsão (ida e volta) em formato de texto.
              </Typography>
              <Button variant="outlined" fullWidth startIcon={<ContentCopyIcon />} onClick={handleCopy}>
                Copiar Resultado
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          <LocalGasStationOutlinedIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
          Veículo: {vehicle.label} ({vehicle.fuelType}) · Perfil: {profile}{plate ? ` · Placa: ${plate}` : ''}
        </Typography>
      </Box>

      <Snackbar open={copied} autoHideDuration={2500} onClose={() => setCopied(false)}>
        <Alert severity="success" onClose={() => setCopied(false)}>Resultado copiado para a área de transferência.</Alert>
      </Snackbar>
    </Box>
  );
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, color: 'primary.main' }}>
      {icon}
      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </Typography>
    </Stack>
  );
}

function StatCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <CardHeader icon={icon} title={label} />
        <Typography variant="h4">{value}</Typography>
        {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
      </CardContent>
    </Card>
  );
}

function ScenarioRows({ pessimistic, medium, optimistic }: { pessimistic: string; medium: string; optimistic: string }) {
  const rows = [
    { label: 'Econômico', value: optimistic },
    { label: 'Operação Normal', value: medium },
    { label: 'Condição Severa', value: pessimistic }
  ];
  return (
    <Stack spacing={0.5}>
      {rows.map((r) => (
        <Stack key={r.label} direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">{r.label}</Typography>
          <Typography variant="body2" fontWeight={700}>{r.value}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function ScenarioRows3({
  econLabel, econSub, econValue,
  normalLabel, normalSub, normalValue,
  severeLabel, severeSub, severeValue
}: {
  econLabel: string; econSub: string; econValue: string;
  normalLabel: string; normalSub: string; normalValue: string;
  severeLabel: string; severeSub: string; severeValue: string;
}) {
  const rows = [
    { label: econLabel, sub: econSub, value: econValue },
    { label: normalLabel, sub: normalSub, value: normalValue },
    { label: severeLabel, sub: severeSub, value: severeValue }
  ];
  return (
    <Stack spacing={1.5}>
      {rows.map((r) => (
        <Stack key={r.label} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600}>{r.label}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{r.sub}</Typography>
          </Box>
          <Typography variant="body1" fontWeight={700} sx={{ whiteSpace: 'nowrap', pl: 1 }}>{r.value}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function safetyMarginLine(percent: number): string {
  return percent > 0 ? `Margem de segurança operacional aplicada: +${percent}%` : 'Margem de segurança operacional: padrão (0%)';
}

function safetyEmoji(level: 'green' | 'yellow' | 'red'): string {
  return level === 'green' ? '🟢' : level === 'yellow' ? '🟡' : '🔴';
}

function buildSummaryText(r: PredictionResult): string {
  return [
    'OrácuLocaliza — Previsão de Trajeto',
    '',
    `Origem: ${r.origin.code} — ${r.origin.name}`,
    `${r.origin.address}`,
    `Via: ${r.waypoint.name} (${r.waypoint.address})`,
    `Abastecimento no posto: chegou com ${r.refuelInfo.arrivalTankBeforeRefuel}/8, abasteceu ${r.refuelInfo.litersRefueled} L de ${r.refuelInfo.fuelType}`,
    '',
    `Destino: ${r.destination.code} — ${r.destination.name}`,
    `${r.destination.fullAddress || r.destination.address}`,
    r.destination.neighborhood ? `Bairro: ${r.destination.neighborhood}` : '',
    r.destination.reference ? `Referência: ${r.destination.reference}` : '',
    r.destination.zone ? `Zona: ${r.destination.zone}` : '',
    '',
    `Veículo: ${r.vehicle.label} (${r.vehicle.fuelType})`,
    r.plate ? `Placa: ${r.plate}` : '',
    `Perfil: ${r.profile}`,
    `Tanque inicial: ${formatEighths(r.tankLevelStart)}`,
    '',
    `Distância (ida): ${r.route.distanceKm} km`,
    `Tempo previsto (ida): ${formatMinutes(r.route.durationMin)}`,
    '',
    'Consumo previsto (ida, litros):',
    `  Cenário Econômico: ${r.fuel.liters.optimistic} L`,
    `  Operação Normal: ${r.fuel.liters.medium} L`,
    `  Condição Severa: ${r.fuel.liters.pessimistic} L`,
    '',
    'Tanque previsto na chegada:',
    `  Cenário Econômico: ${formatEighths(r.fuel.arrivalTankEighths.optimistic)}`,
    `  Operação Normal: ${formatEighths(r.fuel.arrivalTankEighths.medium)}`,
    `  Condição Severa: ${formatEighths(r.fuel.arrivalTankEighths.pessimistic)}`,
    '',
    safetyMarginLine(r.safetyMarginPercent),
    `Indicador de segurança: ${safetyEmoji(r.safetyIndicator.level)} ${r.safetyIndicator.label} — ${r.safetyIndicator.message}`,
    '',
    `Distância de volta (Destino → CDBRI): ${r.returnTrip.distanceKm} km`,
    'Combustível necessário para o retorno:',
    `  Cenário Econômico: ${r.returnTrip.litersNeeded.optimistic} L (${r.returnTrip.canReturn.optimistic ? 'consegue retornar' : 'NÃO consegue retornar sem abastecer'})`,
    `  Operação Normal: ${r.returnTrip.litersNeeded.medium} L (${r.returnTrip.canReturn.medium ? 'consegue retornar' : 'NÃO consegue retornar sem abastecer'})`,
    `  Condição Severa: ${r.returnTrip.litersNeeded.pessimistic} L (${r.returnTrip.canReturn.pessimistic ? 'consegue retornar' : 'NÃO consegue retornar sem abastecer'})`,
    '',
    `Google Maps: ${r.mapsUrl}`,
    `Waze: ${r.wazeUrl}`
  ].filter((l) => l !== '').join('\n');
}
