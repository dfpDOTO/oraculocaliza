import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Grid, TextField, Typography, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, Chip, Stack, Button,
  Alert, TablePagination, CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { searchHistory, isPendingSync } from '../services/historyService';
import { exportQueriesToExcel, todayFileName } from '../services/excelExport';
import ResultCards from '../components/ResultCards';
import type { PredictionResult } from '../types';

export default function HistoryPage() {
  const [selected, setSelected] = useState<PredictionResult | null>(null);

  if (selected) {
    return <HistoryDetail result={selected} onBack={() => setSelected(null)} />;
  }

  return <HistoryList onSelect={setSelected} />;
}

function HistoryDetail({ result, onBack }: { result: PredictionResult; onBack: () => void }) {
  return (
    <Box className="fade-in-up">
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
        Voltar ao histórico
      </Button>
      <Alert severity="info" sx={{ mb: 3 }}>
        Visualizando uma consulta já salva, feita em {new Date(result.createdAt).toLocaleString('pt-BR')}.
        Todos os dados abaixo (incluindo o mapa) são os que foram salvos na hora — nada é recalculado ao abrir aqui.
      </Alert>
      <ResultCards result={result} />
    </Box>
  );
}

function HistoryList({ onSelect }: { onSelect: (r: PredictionResult) => void }) {
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const [allResults, setAllResults] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      searchHistory({ plate, model, destination, date, hour })
        .then((rows) => { setAllResults(rows); setPage(0); })
        .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao pesquisar histórico.'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [plate, model, destination, date, hour]);

  const rows = allResults.slice(page * pageSize, page * pageSize + pageSize);

  const handleClear = () => {
    setPlate(''); setModel(''); setDestination(''); setDate(''); setHour('');
  };

  const handleExportFiltered = () => {
    if (allResults.length === 0) {
      setExportMsg('Nenhuma consulta para exportar com os filtros atuais.');
      return;
    }
    exportQueriesToExcel(allResults, `oraculolocaliza-filtro-${todayFileName()}`);
  };

  const handleExportToday = async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayResults = await searchHistory({ date: todayStr });
    if (todayResults.length === 0) {
      setExportMsg('Nenhuma consulta salva hoje ainda.');
      return;
    }
    exportQueriesToExcel(todayResults, todayFileName());
  };

  return (
    <Box className="fade-in-up">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 0.5 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Histórico de Consultas</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Pesquise por placa, modelo, destino, código, data ou hora. Toque em "Ver consulta" para todos os detalhes.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportToday}>
            Excel de hoje
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportFiltered}>
            Exportar filtrado
          </Button>
        </Stack>
      </Box>

      {exportMsg && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setExportMsg(null)}>{exportMsg}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Placa" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Modelo" value={model} onChange={(e) => setModel(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Destino / Código" value={destination} onChange={(e) => setDestination(e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                fullWidth size="small" InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                label="Hora" type="number" value={hour} onChange={(e) => setHour(e.target.value)}
                fullWidth size="small" inputProps={{ min: 0, max: 23 }} placeholder="0-23"
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }} alignItems="center">
            <Button variant="text" startIcon={<ClearIcon />} onClick={handleClear}>
              Limpar filtros
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', gap: 1 }}>
              {loading ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
              <Typography variant="body2">{loading ? 'Pesquisando...' : `${allResults.length} resultado(s)`}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data / Hora</TableCell>
                <TableCell>Placa</TableCell>
                <TableCell>Modelo</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell align="center">Segurança</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Nenhuma consulta encontrada.</Typography>
                </TableCell></TableRow>
              )}
              {rows.map((r: PredictionResult) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')}<br />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(r.createdAt).toLocaleTimeString('pt-BR')}
                    </Typography>
                    {isPendingSync(r.id) && (
                      <Chip size="small" color="warning" label="Sincronizando..." sx={{ display: 'block', mt: 0.5, width: 'fit-content' }} />
                    )}
                  </TableCell>
                  <TableCell>{r.plate || '-'}</TableCell>
                  <TableCell>{r.vehicle.label}</TableCell>
                  <TableCell>{r.destination.code} — {r.destination.name}</TableCell>
                  <TableCell align="center">
                    {r.safetyIndicator.level === 'green' ? '🟢' : r.safetyIndicator.level === 'yellow' ? '🟡' : '🔴'}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => onSelect(r)}>
                      Ver consulta
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={allResults.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
        />
      </Card>
    </Box>
  );
}
