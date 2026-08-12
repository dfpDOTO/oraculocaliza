import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, ToggleButtonGroup, ToggleButton,
  Slider, Alert, Stack, TextField, Button, Grid, CircularProgress, Divider
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import {
  getSafetyMarginSettings, setSafetyMarginPreset, setSafetyMarginCustomPercent,
  MARGIN_PRESETS
} from '../services/settingsService';
import type { MarginPreset } from '../services/settingsService';
import { getLocationOverride, setLocationOverride } from '../services/locationOverrideService';
import { useAuth } from '../contexts/AuthContext';
import { CDBRI, POSTO } from '../config';

export default function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'administrador';
  const [settings, setSettings] = useState(getSafetyMarginSettings());

  const handlePreset = (_: unknown, value: MarginPreset | null) => {
    if (!value) return;
    if (value === 'personalizada') {
      setSettings(setSafetyMarginCustomPercent(settings.percent));
    } else {
      setSettings(setSafetyMarginPreset(value));
    }
  };

  const handleSlider = (_: unknown, value: number | number[]) => {
    const percent = Array.isArray(value) ? value[0] : value;
    setSettings(setSafetyMarginCustomPercent(percent));
  };

  return (
    <Box className="fade-in-up">
      <Typography variant="h4" sx={{ mb: 0.5 }}>Configurações</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Margem de Segurança Operacional e localização exata dos pontos fixos da rota.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        {isAdmin
          ? 'Estas configurações valem para todos os usuários do sistema.'
          : 'Estas configurações são somente leitura — só Administradores podem alterá-las.'}
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, color: 'primary.main' }}>
            <TuneIcon />
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Margem de Segurança Operacional
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Não altera o consumo oficial do fabricante — acrescenta uma reserva extra aos três cenários
            de consumo (Econômico, Operação Normal, Condição Severa), para representar o uso real do veículo.
          </Typography>

          <ToggleButtonGroup
            value={settings.preset}
            exclusive
            onChange={handlePreset}
            fullWidth
            disabled={!isAdmin}
            sx={{ mb: 3, flexWrap: 'wrap' }}
          >
            <ToggleButton value="conservadora" sx={{ textTransform: 'none', py: 1.5 }}>
              Conservadora<br /><Typography variant="caption">+{MARGIN_PRESETS.conservadora}%</Typography>
            </ToggleButton>
            <ToggleButton value="padrao" sx={{ textTransform: 'none', py: 1.5 }}>
              Padrão<br /><Typography variant="caption">+{MARGIN_PRESETS.padrao}%</Typography>
            </ToggleButton>
            <ToggleButton value="severa" sx={{ textTransform: 'none', py: 1.5 }}>
              Severa<br /><Typography variant="caption">+{MARGIN_PRESETS.severa}%</Typography>
            </ToggleButton>
            <ToggleButton value="personalizada" sx={{ textTransform: 'none', py: 1.5 }}>
              Personalizada<br /><Typography variant="caption">{settings.percent}%</Typography>
            </ToggleButton>
          </ToggleButtonGroup>

          {settings.preset === 'personalizada' && (
            <Box sx={{ px: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Percentual personalizado: {settings.percent}%
              </Typography>
              <Slider
                value={settings.percent}
                onChange={handleSlider}
                min={0}
                max={50}
                step={1}
                valueLabelDisplay="auto"
                disabled={!isAdmin}
                sx={{ color: 'primary.main' }}
              />
            </Box>
          )}

          <Alert severity="success" sx={{ mt: 3 }}>
            Margem atual aplicada às próximas previsões: <strong>+{settings.percent}%</strong>
          </Alert>
        </CardContent>
      </Card>

      <LocationOverrideCard
        title="Localização exata — CDBRI"
        subtitle={`${CDBRI.name} (${CDBRI.address})`}
        overrideKey="cdbri_location"
        isAdmin={isAdmin}
      />

      <LocationOverrideCard
        title="Localização exata — Posto autorizado"
        subtitle={`${POSTO.name} (${POSTO.address})`}
        overrideKey="posto_location"
        isAdmin={isAdmin}
      />
    </Box>
  );
}

function LocationOverrideCard({
  title, subtitle, overrideKey, isAdmin
}: {
  title: string;
  subtitle: string;
  overrideKey: 'cdbri_location' | 'posto_location';
  isAdmin: boolean;
}) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getLocationOverride(overrideKey)
      .then((loc) => {
        if (loc) { setLat(String(loc.lat)); setLng(String(loc.lng)); }
      })
      .finally(() => setLoading(false));
  }, [overrideKey]);

  const handleSave = async () => {
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setMessage({ type: 'error', text: 'Coordenadas inválidas. Use o formato -23.4936, -46.8619.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await setLocationOverride(overrideKey, { lat: latNum, lng: lngNum });
      setMessage({ type: 'success', text: 'Localização salva! Vale para todos os usuários a partir de agora.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setLocationOverride(overrideKey, null);
      setLat('');
      setLng('');
      setMessage({ type: 'success', text: 'Ajuste removido — volta a usar a geocodificação automática pelo endereço.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao limpar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, color: 'primary.main' }}>
          <MyLocationIcon />
          <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {title}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          Se o mapa mostrar o ponto no lugar errado: abra o <strong>Google Maps</strong>, encontre o local certo,
          <strong> segure o dedo</strong> sobre o ponto exato até aparecer um alfinete, e toque nele — as coordenadas
          aparecem na parte de baixo da tela (ex: <code>-23.4936, -46.8619</code>). Cole os dois números abaixo.
        </Alert>

        {loading ? (
          <CircularProgress size={22} />
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <TextField label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} fullWidth disabled={!isAdmin} placeholder="-23.4936" />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} fullWidth disabled={!isAdmin} placeholder="-46.8619" />
              </Grid>
            </Grid>

            {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}

            {isAdmin && (
              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" onClick={handleSave} disabled={saving || !lat || !lng}>
                  {saving ? 'Salvando...' : 'Salvar coordenada exata'}
                </Button>
                <Button variant="text" onClick={handleClear} disabled={saving}>
                  Remover ajuste
                </Button>
              </Stack>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
