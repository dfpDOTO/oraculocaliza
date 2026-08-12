import { useEffect, useState } from 'react';
import { AppBar, Toolbar, Box, Typography, Tabs, Tab, Container, IconButton, Menu, MenuItem, ListItemIcon, CircularProgress, Chip } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardPage from './pages/DashboardPage';
import PredictionPage from './pages/PredictionPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { asset } from './utils/assetUrl';
import { ensureStoresLoaded } from './services/storeService';
import { ensureVehiclesLoaded } from './services/vehicleService';

type TabValue = 'dashboard' | 'predict' | 'history' | 'settings' | 'admin';

function AppShell() {
  const { profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<TabValue>('dashboard');
  const [formResetKey, setFormResetKey] = useState(0);
  const [voluntaryChangePassword, setVoluntaryChangePassword] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (!profile) return;
    ensureStoresLoaded().catch(() => {});
    ensureVehiclesLoaded().catch(() => {});
  }, [profile]);

  const goToNewPrediction = () => {
    setFormResetKey((k) => k + 1);
    setTab('predict');
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return <LoginPage />;
  }

  if (profile.must_change_password) {
    return <ChangePasswordPage forced />;
  }

  if (voluntaryChangePassword) {
    return <ChangePasswordPage forced={false} />;
  }

  const isAdmin = profile.role === 'administrador';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(15,17,20,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Box component="img" src={asset('logo.png')} alt="OrácuLocaliza" sx={{ width: 34, height: 34, borderRadius: '10px' }} />
          <Typography variant="h6" sx={{ flexGrow: 0, letterSpacing: 0.2 }}>
            Orácu<Box component="span" sx={{ color: 'primary.main' }}>Localiza</Box>
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            textColor="inherit"
            TabIndicatorProps={{ style: { backgroundColor: '#79DD22', height: 3, borderRadius: 3 } }}
            sx={{ minHeight: 40 }}
          >
            <Tab value="dashboard" label="Início" sx={{ minHeight: 40 }} />
            <Tab value="predict" label="Nova Previsão" sx={{ minHeight: 40 }} />
            <Tab value="history" label="Histórico" sx={{ minHeight: 40 }} />
            <Tab value="settings" label="Configurações" sx={{ minHeight: 40 }} />
            {isAdmin && <Tab value="admin" label="Administração" sx={{ minHeight: 40 }} />}
          </Tabs>

          <Chip
            size="small"
            label={profile.role}
            sx={{ ml: 1.5, textTransform: 'capitalize', display: { xs: 'none', sm: 'inline-flex' } }}
          />

          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ ml: 1 }}>
            <AccountCircleIcon />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>{profile.username}</MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); setVoluntaryChangePassword(true); }}>
              <ListItemIcon><LockResetIcon fontSize="small" /></ListItemIcon>
              Alterar minha senha
            </MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); signOut(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        {tab === 'dashboard' && <DashboardPage onNewPrediction={goToNewPrediction} />}
        {tab === 'predict' && <PredictionPage resetKey={formResetKey} />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'settings' && <SettingsPage />}
        {tab === 'admin' && isAdmin && <AdminPage />}
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
