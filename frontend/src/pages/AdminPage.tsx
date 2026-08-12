import { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, Card, CardContent, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Chip, Stack, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Alert, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, List, ListItem, ListItemText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';
import DevicesIcon from '@mui/icons-material/Devices';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import {
  listUsers, createUser, updateUserRole, updateUserActive,
  resetUserPassword, deleteUser, listAuditLog, AdminError,
  setMaxDevices, listUserDevices, removeDevice
} from '../services/adminService';
import type { Profile } from '../services/authService';
import type { AuditLogRow, DeviceRow } from '../services/adminService';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'audit'>('users');

  return (
    <Box className="fade-in-up">
      <Typography variant="h4" sx={{ mb: 0.5 }}>Administração</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Gestão de usuários, permissões e auditoria do sistema.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab value="users" label="Usuários" />
        <Tab value="audit" label="Auditoria" />
      </Tabs>

      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </Box>
  );
}

function UsersTab() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<Profile['role']>('operador');
  const [newMaxDevices, setNewMaxDevices] = useState(2);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [devicesUser, setDevicesUser] = useState<Profile | null>(null);

  const load = () => {
    setLoading(true);
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof AdminError ? err.message : 'Erro ao carregar usuários.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await createUser(newUsername, newRole, newMaxDevices);
      setSuccess(`Usuário "${newUsername}" criado com senha inicial "123456".`);
      setCreateOpen(false);
      setNewUsername('');
      setNewRole('operador');
      setNewMaxDevices(2);
      load();
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'Erro ao criar usuário.');
    } finally {
      setCreating(false);
    }
  };

  const withBusy = async (id: string, fn: () => Promise<void>, successMsg: string) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      setSuccess(successMsg);
      load();
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'Erro na operação.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Novo usuário
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Usuário</TableCell>
                <TableCell>Papel</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Limite de aparelhos</TableCell>
                <TableCell>Primeiro acesso</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={22} /></TableCell></TableRow>
              )}
              {!loading && users.map((u) => {
                const isSelf = u.id === myProfile?.id;
                const locked = u.is_protected && !isSelf; // protegido para todo mundo, menos ele mesmo
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      {u.username}
                      {u.is_protected && (
                        <Tooltip title="Protegido — só este usuário pode alterar o próprio perfil">
                          <LockIcon fontSize="inherit" sx={{ ml: 0.5, verticalAlign: 'middle', color: 'text.secondary' }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" variant="standard">
                        <Select
                          value={u.role}
                          disabled={busyId === u.id || locked}
                          onChange={(e) => withBusy(u.id, () => updateUserRole(u.id, e.target.value as Profile['role']), 'Papel atualizado.')}
                        >
                          <MenuItem value="administrador">Administrador</MenuItem>
                          <MenuItem value="supervisor">Supervisor</MenuItem>
                          <MenuItem value="operador">Operador</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.is_active ? 'Ativo' : 'Desativado'}
                        color={u.is_active ? 'success' : 'default'}
                        onClick={locked ? undefined : () => withBusy(u.id, () => updateUserActive(u.id, !u.is_active), u.is_active ? 'Usuário desativado.' : 'Usuário ativado.')}
                        sx={{ cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.6 : 1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" variant="standard">
                        <Select
                          value={u.max_devices ?? 2}
                          disabled={busyId === u.id || locked}
                          onChange={(e) => withBusy(u.id, () => setMaxDevices(u.id, Number(e.target.value)), 'Limite de aparelhos atualizado.')}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <MenuItem key={n} value={n}>{n} aparelho{n > 1 ? 's' : ''}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      {u.must_change_password ? <Chip size="small" label="Pendente" color="warning" /> : <Chip size="small" label="Concluído" />}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver / remover aparelhos conectados">
                        <IconButton size="small" onClick={() => setDevicesUser(u)}>
                          <DevicesIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={locked ? 'Protegido' : 'Resetar senha para 123456'}>
                        <span>
                          <IconButton size="small" disabled={busyId === u.id || locked} onClick={() => withBusy(u.id, () => resetUserPassword(u.id), 'Senha resetada para "123456".')}>
                            <LockResetIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={locked ? 'Protegido' : 'Excluir usuário'}>
                        <span>
                          <IconButton size="small" color="error" disabled={busyId === u.id || locked} onClick={() => {
                            if (confirm(`Excluir o usuário "${u.username}"? Essa ação não pode ser desfeita.`)) {
                              withBusy(u.id, () => deleteUser(u.id), 'Usuário excluído.');
                            }
                          }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Novo usuário</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome de usuário"
            fullWidth
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="new-role-label">Papel</InputLabel>
            <Select labelId="new-role-label" label="Papel" value={newRole} onChange={(e) => setNewRole(e.target.value as Profile['role'])}>
              <MenuItem value="administrador">Administrador</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              <MenuItem value="operador">Operador</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="new-max-devices-label">Limite de aparelhos</InputLabel>
            <Select labelId="new-max-devices-label" label="Limite de aparelhos" value={newMaxDevices} onChange={(e) => setNewMaxDevices(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <MenuItem key={n} value={n}>{n} aparelho{n > 1 ? 's' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ mt: 2 }}>
            A senha inicial será <strong>123456</strong>. O usuário será obrigado a trocá-la no primeiro acesso.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newUsername.trim()}>
            {creating ? 'Criando...' : 'Criar usuário'}
          </Button>
        </DialogActions>
      </Dialog>

      {devicesUser && (
        <DevicesDialog
          user={devicesUser}
          onClose={() => setDevicesUser(null)}
          onChanged={() => { load(); }}
        />
      )}
    </Box>
  );
}

function DevicesDialog({ user, onClose, onChanged }: { user: Profile; onClose: () => void; onChanged: () => void }) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    listUserDevices(user.id)
      .then(setDevices)
      .catch((err) => setError(err instanceof AdminError ? err.message : 'Erro ao carregar aparelhos.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user.id]);

  const handleRemove = async (deviceId: number) => {
    setRemovingId(deviceId);
    setError(null);
    try {
      await removeDevice(deviceId);
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'Erro ao remover aparelho.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Aparelhos de {user.username}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Limite atual: <strong>{user.max_devices} aparelho{user.max_devices > 1 ? 's' : ''}</strong>
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <CircularProgress size={22} />
        ) : devices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Nenhum aparelho conectado no momento.</Typography>
        ) : (
          <List dense>
            {devices.map((d) => (
              <ListItem
                key={d.id}
                secondaryAction={
                  <IconButton edge="end" size="small" disabled={removingId === d.id} onClick={() => handleRemove(d.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={d.device_label || 'Dispositivo'}
                  secondary={`Último acesso: ${new Date(d.last_seen_at).toLocaleString('pt-BR')}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditLog(200)
      .then(setRows)
      .catch((err) => setError(err instanceof AdminError ? err.message : 'Erro ao carregar auditoria.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data / Hora</TableCell>
                <TableCell>Usuário</TableCell>
                <TableCell>Ação</TableCell>
                <TableCell>Detalhes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress size={22} /></TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Nenhum evento registrado.</Typography>
                </TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}{' '}
                    <Typography variant="caption" color="text.secondary">{new Date(r.created_at).toLocaleTimeString('pt-BR')}</Typography>
                  </TableCell>
                  <TableCell>{r.username || '—'}</TableCell>
                  <TableCell><Chip size="small" label={r.action} /></TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      {JSON.stringify(r.details)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
