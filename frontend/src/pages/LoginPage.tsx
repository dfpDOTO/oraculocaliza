import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress, InputAdornment, IconButton } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { login, AuthError } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { asset } from '../utils/assetUrl';

export default function LoginPage() {
  const { refreshProfile, bootstrapError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Informe usuário e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              component="img"
              src={asset('logo-wide.png')}
              alt="OrácuLocaliza"
              sx={{ width: '100%', maxWidth: 280, height: 'auto', mb: 1.5, borderRadius: '10px' }}
            />
            <Typography variant="body2" color="text.secondary">Entre com seu usuário para continuar</Typography>
          </Box>

          {bootstrapError && (
            <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
              <strong>Não foi possível preparar o usuário inicial.</strong><br />
              Motivo técnico: {bootstrapError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              autoFocus
              sx={{ mb: 2 }}
              autoComplete="username"
            />
            <TextField
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              sx={{ mb: 3 }}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((s) => !s)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ py: 1.4 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
