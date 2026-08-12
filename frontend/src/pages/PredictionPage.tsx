import { useEffect, useRef, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, TextField, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Checkbox,
  Select, MenuItem, InputLabel, Alert, CircularProgress, Divider
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import CalculateIcon from '@mui/icons-material/Calculate';
import DestinationAutocomplete from '../components/DestinationAutocomplete';
import VehicleAutocomplete from '../components/VehicleAutocomplete';
import ResultCards from '../components/ResultCards';
import { geocodeAddress } from '../services/geocodingService';
import { calculateRoute, calculateCachedLeg, mergeRouteInfos } from '../services/routingService';
import { calculateFuelPrediction, calculateReturnTrip, computeSafetyIndicator } from '../services/fuelCalculator';
import { buildGoogleMapsUrl, buildWazeUrl } from '../services/navigationLinks';
import { saveQuery } from '../services/historyService';
import type { SaveOutcome } from '../services/historyService';
import { getSafetyMarginSettings } from '../services/settingsService';
import { getLocationOverride } from '../services/locationOverrideService';
import { CDBRI, POSTO } from '../config';
import { formatEighths } from '../utils/format';
import type { Profile, Store, Vehicle, PredictionResult, RefuelInfo } from '../types';

const TANK_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

interface Props {
  resetKey: number;
}

export default function PredictionPage({ resetKey }: Props) {
  const plateRef = useRef<HTMLInputElement | null>(null);

  const [plate, setPlate] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [profile, setProfile] = useState<Profile>('Moderado');

  // Abastecimento no posto (antes da partida)
  const [arrivalTankBeforeRefuel, setArrivalTankBeforeRefuel] = useState<number>(2);
  const [litersRefueled, setLitersRefueled] = useState<string>('');
  const [fuelEtanol, setFuelEtanol] = useState(false);
  const [fuelGasoline, setFuelGasoline] = useState(false);
  const [fuelDiesel, setFuelDiesel] = useState(false);

  const [tankLevel, setTankLevel] = useState<number | ''>('');
  const [destination, setDestination] = useState<Store | null>(null);

  // Previsão do nível esperado após abastecimento (item 2) — calculada só
  // quando o operador clica em "Calcular", não sobrescreve automaticamente
  // o campo "Nível do tanque (partida)", que continua sendo preenchido
  // manualmente pelo operador com o que ele lê no painel do veículo.
  const [expectedTankAfterRefuel, setExpectedTankAfterRefuel] = useState<number | null>(null);
  const [refuelCalcError, setRefuelCalcError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveOutcome | null>(null);
  const [errors, setErrors] = useState<{ vehicle?: string; destination?: string; tankLevel?: string }>({});

  const handleCalculateExpectedTank = () => {
    setRefuelCalcError(null);
    if (!vehicle) {
      setRefuelCalcError('Selecione o modelo do veículo primeiro.');
      setExpectedTankAfterRefuel(null);
      return;
    }
    const liters = parseFloat(litersRefueled.replace(',', '.'));
    if (Number.isNaN(liters) || liters < 0) {
      setRefuelCalcError('Informe a quantidade abastecida (litros).');
      setExpectedTankAfterRefuel(null);
      return;
    }
    // Cada "1/8" do tanque equivale, em média, a capacidade/8 litros.
    // Ex: tanque de 48L -> cada 1/8 = 6L. Soma o quanto foi abastecido
    // (convertido em oitavos) ao nível de chegada informado.
    const litersPerEighth = vehicle.tankCapacityLiters / 8;
    const addedEighths = liters / litersPerEighth;
    const expected = Math.max(0, Math.min(8, Math.round(arrivalTankBeforeRefuel + addedEighths)));
    setExpectedTankAfterRefuel(expected);
  };

  const resetForm = () => {
    setPlate('');
    setVehicle(null);
    setProfile('Moderado');
    setArrivalTankBeforeRefuel(2);
    setLitersRefueled('');
    setFuelEtanol(false);
    setFuelGasoline(false);
    setFuelDiesel(false);
    setTankLevel('');
    setExpectedTankAfterRefuel(null);
    setRefuelCalcError(null);
    setDestination(null);
  };

  // "Nova Previsão": limpa formulário, volta ao topo e foca no primeiro campo
  useEffect(() => {
    if (resetKey === 0) return;
    resetForm();
    setResult(null);
    setSaveStatus(null);
    setError(null);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => plateRef.current?.focus(), 300);
  }, [resetKey]);

  const handleSubmit = async () => {
    const newErrors: typeof errors = {};
    if (!vehicle) newErrors.vehicle = 'Selecione o modelo do veículo.';
    if (!destination) newErrors.destination = 'Selecione o destino.';
    if (tankLevel === '') newErrors.tankLevel = 'Obrigatório selecionar o nível do tanque na partida.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setLoadingMessage('Localizando endereços (Google Maps)...');
      const [cdbriOverride, postoOverride] = await Promise.all([
        getLocationOverride('cdbri_location'),
        getLocationOverride('posto_location')
      ]);

      const [cdbriLocation, postoLocation, destinationLocation] = await Promise.all([
        cdbriOverride ? Promise.resolve(cdbriOverride) : geocodeAddress(CDBRI.address),
        postoOverride ? Promise.resolve(postoOverride) : geocodeAddress(POSTO.address),
        geocodeAddress(destination!.fullAddress || destination!.address)
      ]);

      setLoadingMessage('Calculando rota de ida (CDBRI → Posto → Destino)...');
      // Economia de chamadas de API: CDBRI e Posto são pontos FIXOS — o
      // trecho entre eles é sempre igual, então usamos um valor guardado
      // em cache (até 20 min) em vez de pedir de novo ao Google toda vez.
      // Só o trecho Posto -> Destino (que realmente muda a cada previsão)
      // é calculado na hora, sempre em tempo real.
      const [cdbriToPostoLeg, postoToDestinoLeg] = await Promise.all([
        calculateCachedLeg(cdbriLocation, postoLocation, 'cdbri-posto'),
        calculateRoute([postoLocation, destinationLocation])
      ]);
      const outboundRoute = mergeRouteInfos([cdbriToPostoLeg, postoToDestinoLeg]);

      const marginSettings = getSafetyMarginSettings();

      const fuel = calculateFuelPrediction({
        distanceKm: outboundRoute.distanceKm,
        vehicle: vehicle!,
        profile,
        tankLevelStart: Number(tankLevel),
        safetyMarginPercent: marginSettings.percent
      });

      setLoadingMessage('Calculando rota de volta (Destino → CDBRI)...');
      const returnRoute = await calculateRoute([destinationLocation, cdbriLocation]);

      const returnCalc = calculateReturnTrip({
        returnDistanceKm: returnRoute.distanceKm,
        vehicle: vehicle!,
        profile,
        arrivalLitersAtDestination: fuel.arrivalLiters,
        safetyMarginPercent: marginSettings.percent
      });

      const safetyIndicator = computeSafetyIndicator(
        fuel,
        returnCalc.canReturn.pessimistic,
        returnCalc.arrivalBackTankEighths.pessimistic
      );

      const mapsUrl = buildGoogleMapsUrl(CDBRI.address, POSTO.address, destination!.fullAddress || destination!.address);
      const wazeUrl = buildWazeUrl(destinationLocation);

      const fuelTypeUsed: RefuelInfo['fuelType'] =
        fuelGasoline && fuelDiesel ? 'Gasolina + Diesel' : fuelGasoline ? 'Gasolina' : fuelDiesel ? 'Diesel' : 'Etanol';

      const refuelInfo: RefuelInfo = {
        arrivalTankBeforeRefuel,
        litersRefueled: parseFloat(litersRefueled.replace(',', '.')) || 0,
        fuelType: fuelTypeUsed
      };

      const prediction: PredictionResult = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        refuelInfo,
        origin: { code: CDBRI.code, name: CDBRI.name, address: CDBRI.address, location: cdbriLocation },
        waypoint: { code: POSTO.code, name: POSTO.name, address: POSTO.address, location: postoLocation },
        destination: { ...destination!, location: destinationLocation },
        vehicle: vehicle!,
        plate: plate || null,
        profile,
        tankLevelStart: Number(tankLevel),
        route: outboundRoute,
        fuel,
        returnTrip: {
          distanceKm: returnRoute.distanceKm,
          durationMin: returnRoute.durationMin,
          geometry: returnRoute.geometry,
          litersNeeded: returnCalc.litersNeeded,
          canReturn: returnCalc.canReturn,
          arrivalBackTankEighths: returnCalc.arrivalBackTankEighths
        },
        safetyIndicator,
        safetyMarginPercent: marginSettings.percent,
        mapsUrl,
        wazeUrl
      };

      // Item 7: consulta é salva automaticamente no histórico, sem botão manual.
      // saveQuery() NUNCA perde a consulta: se o salvamento direto falhar, ela
      // entra numa fila local e é sincronizada automaticamente depois — por
      // isso não precisamos (nem devemos) bloquear a exibição do resultado
      // aqui, mas o status (salvo/pendente) é mostrado para o operador no card.
      const outcome = await saveQuery(prediction);
      setSaveStatus(outcome);

      setResult(prediction);
      setTimeout(() => {
        document.getElementById('result-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao calcular a previsão.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <Box className="fade-in-up">
      <Typography variant="h4" sx={{ mb: 0.5 }}>Nova Previsão</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Informe os dados do veículo e o destino. A rota sempre passa por CDBRI → Posto autorizado → Destino, e o sistema já calcula o retorno.
      </Typography>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                inputRef={plateRef}
                label="Placa"
                placeholder="Opcional — ex: ABC1D23"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                fullWidth
                inputProps={{ maxLength: 8 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <VehicleAutocomplete value={vehicle} onChange={(v) => { setVehicle(v); setExpectedTankAfterRefuel(null); }} error={errors.vehicle} />
            </Grid>

            <Grid item xs={12} md={7}>
              <FormControl>
                <FormLabel sx={{ mb: 1, color: 'text.secondary' }}>Perfil do veículo</FormLabel>
                <RadioGroup
                  row
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as Profile)}
                >
                  <FormControlLabel value="Econômico" control={<Radio />} label="Econômico (+12%)" />
                  <FormControlLabel value="Moderado" control={<Radio />} label="Moderado (0%)" />
                  <FormControlLabel value="Alto consumo" control={<Radio />} label="Alto consumo (−18%)" />
                </RadioGroup>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalGasStationIcon fontSize="small" sx={{ color: 'primary.main' }} />
                ABASTECIMENTO NO POSTO
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel id="arrival-tank-label">Tanque ao chegar (antes de abastecer)</InputLabel>
                <Select
                  labelId="arrival-tank-label"
                  label="Tanque ao chegar (antes de abastecer)"
                  value={arrivalTankBeforeRefuel}
                  onChange={(e) => { setArrivalTankBeforeRefuel(Number(e.target.value)); setExpectedTankAfterRefuel(null); }}
                >
                  {TANK_LEVELS.map((n) => (
                    <MenuItem key={n} value={n}>{formatEighths(n)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Quantidade abastecida (litros)"
                value={litersRefueled}
                onChange={(e) => { setLitersRefueled(e.target.value); setExpectedTankAfterRefuel(null); }}
                fullWidth
                placeholder="Ex: 30"
                inputProps={{ inputMode: 'decimal' }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl>
                <FormLabel sx={{ color: 'text.secondary', fontSize: 13 }}>Combustível do abastecimento</FormLabel>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={fuelEtanol}
                        onChange={(e) => {
                          setFuelEtanol(e.target.checked);
                          if (e.target.checked) { setFuelGasoline(false); setFuelDiesel(false); }
                        }}
                        size="small"
                      />
                    }
                    label="Etanol"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={fuelGasoline}
                        onChange={(e) => {
                          setFuelGasoline(e.target.checked);
                          if (e.target.checked) setFuelEtanol(false);
                        }}
                        size="small"
                      />
                    }
                    label="Gasolina"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={fuelDiesel}
                        onChange={(e) => {
                          setFuelDiesel(e.target.checked);
                          if (e.target.checked) setFuelEtanol(false);
                        }}
                        size="small"
                      />
                    }
                    label="Diesel"
                  />
                </Box>
              </FormControl>
            </Grid>

            {!fuelEtanol && !fuelGasoline && !fuelDiesel && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Nenhuma caixa marcada = o sistema considera que foi abastecido com <strong>Etanol</strong> (mesmo assim, marque "Etanol" para deixar registrado explicitamente).
                </Typography>
              </Grid>
            )}

            <Grid item xs={12}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CalculateIcon />}
                onClick={handleCalculateExpectedTank}
              >
                Calcular nível esperado após abastecimento
              </Button>
              {refuelCalcError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  {refuelCalcError}
                </Typography>
              )}
              {expectedTankAfterRefuel !== null && !refuelCalcError && (
                <Alert severity="info" icon={<CalculateIcon fontSize="small" />} sx={{ mt: 1.5 }}>
                  Esperado após abastecimento: <strong>{expectedTankAfterRefuel}/8</strong>
                  {' '}— compare com o marcador do painel do veículo e informe abaixo o que você observou.
                </Alert>
              )}
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
            </Grid>

            <Grid item xs={12} md={5}>
              <FormControl fullWidth error={!!errors.tankLevel}>
                <InputLabel id="tank-level-label">Nível do tanque (partida) — informado pelo operador *</InputLabel>
                <Select
                  labelId="tank-level-label"
                  label="Nível do tanque (partida) — informado pelo operador *"
                  value={tankLevel}
                  displayEmpty
                  onChange={(e) => setTankLevel(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <MenuItem value="" disabled>Selecione o nível observado...</MenuItem>
                  {TANK_LEVELS.map((n) => (
                    <MenuItem key={n} value={n}>{formatEighths(n)}</MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color={errors.tankLevel ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.5 }}>
                  {errors.tankLevel || 'Obrigatório — informe o que você observa no painel do veículo (usado nos cálculos da viagem).'}
                </Typography>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Origem"
                value={`${CDBRI.code} — ${CDBRI.name}`}
                fullWidth
                disabled
                helperText={`${CDBRI.address}  ·  via ${POSTO.name}`}
                InputProps={{
                  startAdornment: <LockIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DestinationAutocomplete value={destination} onChange={setDestination} error={errors.destination} />
            </Grid>
          </Grid>

          {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}

          <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{ px: 5, py: 1.6, fontSize: 18, flexGrow: { xs: 1, sm: 0 } }}
            >
              {loading ? 'Calculando...' : 'PREVISÃO'}
            </Button>

            {loading && loadingMessage && (
              <Typography variant="body2" color="text.secondary">{loadingMessage}</Typography>
            )}

            {result && !loading && (
              <Button
                variant="text"
                size="large"
                startIcon={<RestartAltIcon />}
                onClick={() => {
                  setResult(null);
                  setSaveStatus(null);
                  resetForm();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setTimeout(() => plateRef.current?.focus(), 300);
                }}
              >
                Nova Previsão
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <div id="result-anchor" />
      {result && <ResultCards result={result} saveStatus={saveStatus} />}
    </Box>
  );
}
