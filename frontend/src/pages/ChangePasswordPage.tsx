import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress, List, ListItem, ListItemText } from '@mui/material';
import { changeOwnPassword, validatePassword, AuthError } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { asset } from '../utils/assetUrl';

interface Props {
  forced?: boolean;
}

export default function ChangePasswordPage({ forced = true }: Props) {
  const { refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await changeOwnPassword(password);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            component="img"
            src={asset('logo-wide.png')}
            alt="OrácuLocaliza"
            sx={{ width: '100%', maxWidth: 220, height: 'auto', mb: 2.5, borderRadius: '10px', display: 'block' }}
          />
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            {forced ? 'Defina sua nova senha' : 'Alterar senha'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {forced
              ? 'Este é seu primeiro acesso (ou sua senha foi redefinida). Por segurança, crie uma nova senha antes de continuar.'
              : 'Escolha uma nova senha.'}
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>A senha precisa ter:</Typography>
            <List dense sx={{ py: 0 }}>
              <ListItem sx={{ py: 0, display: 'list-item', pl: 2 }}><ListItemText primary="No mínimo 6 caracteres" /></ListItem>
              <ListItem sx={{ py: 0, display: 'list-item', pl: 2 }}><ListItemText primary="1 letra maiúscula" /></ListItem>
              <ListItem sx={{ py: 0, display: 'list-item', pl: 2 }}><ListItemText primary="1 número" /></ListItem>
              <ListItem sx={{ py: 0, display: 'list-item', pl: 2 }}><ListItemText primary="1 caractere especial (ex: ! @ # $)" /></ListItem>
            </List>
          </Alert>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Nova senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoFocus
              sx={{ mb: 2 }}
              autoComplete="new-password"
            />
            <TextField
              label="Confirmar nova senha"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              fullWidth
              sx={{ mb: 3 }}
              autoComplete="new-password"
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
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
