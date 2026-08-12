import { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, Alert, Skeleton } from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import PlaceIcon from '@mui/icons-material/Place';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HistoryIcon from '@mui/icons-material/History';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { getDashboardData } from '../services/historyService';
import { asset } from '../utils/assetUrl';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardData } from '../types';

interface Props {
  onNewPrediction: () => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage({ onNewPrediction }: Props) {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar o painel.'));
  }, []);

  const stats = [
    { label: 'Consultas hoje', value: data?.queriesToday ?? 0, icon: <AssessmentIcon /> },
    { label: 'KM previstos hoje', value: data ? `${data.kmToday} km` : '0 km', icon: <RouteIcon /> },
    { label: 'Litros previstos hoje', value: data ? `${data.litersToday} L` : '0 L', icon: <LocalGasStationIcon /> },
    { label: 'Destino mais pesquisado', value: data?.topDestination ?? '-', icon: <PlaceIcon /> },
    { label: 'Modelo mais utilizado', value: data?.topModel ?? '-', icon: <DirectionsCarIcon /> },
    {
      label: 'Última consulta',
      value: data?.lastQuery
        ? `${data.lastQuery.destination.name} · ${new Date(data.lastQuery.createdAt).toLocaleTimeString('pt-BR')}`
        : 'Nenhuma consulta ainda',
      icon: <HistoryIcon />
    }
  ];

  return (
    <Box className="fade-in-up">
      <Box
        component="img"
        src={asset('logo-wide.png')}
        alt="OrácuLocaliza"
        sx={{
          width: '100%',
          maxWidth: 420,
          height: 'auto',
          display: 'block',
          mb: 3,
          borderRadius: '14px'
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">{greeting()}{profile ? `, ${profile.username}` : ''}</Typography>
          <Typography variant="body1" color="text.secondary">
            {data ? `Você já fez ${data.queriesToday} consulta(s) hoje.` : 'Visão geral das previsões de trajeto de hoje.'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddCircleIcon />}
          onClick={onNewPrediction}
          sx={{ fontSize: 16, py: 1.4 }}
        >
          Nova Previsão
        </Button>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        {stats.map((s) => (
          <Grid item xs={12} sm={6} md={4} key={s.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48, height: 48, borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: 'rgba(121,221,34,0.14)', color: 'primary.main', flexShrink: 0
                  }}
                >
                  {s.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                  {data ? (
                    <Typography variant="h6" noWrap title={String(s.value)}>{s.value}</Typography>
                  ) : (
                    <Skeleton width={100} height={28} />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
