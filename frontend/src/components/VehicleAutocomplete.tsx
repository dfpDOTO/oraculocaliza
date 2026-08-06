import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { searchVehicles, ensureVehiclesLoaded } from '../services/vehicleService';
import type { Vehicle } from '../types';

interface Props {
  value: Vehicle | null;
  onChange: (vehicle: Vehicle | null) => void;
  error?: string;
}

export default function VehicleAutocomplete({ value, onChange, error }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    ensureVehiclesLoaded()
      .then(() => setReady(true))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar veículos.'));
  }, []);

  const options = useMemo(() => (ready ? searchVehicles(inputValue) : []), [inputValue, ready]);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      getOptionLabel={(o) => (o ? o.label : '')}
      isOptionEqualToValue={(o, v) => o.model === v.model}
      noOptionsText={loadError ? loadError : !ready ? 'Carregando veículos...' : 'Nenhum veículo encontrado'}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.model} sx={{ display: 'flex !important', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DirectionsCarIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="body2">{option.label}</Typography>
          </Box>
          <Chip size="small" label={`${option.tankCapacityLiters} L`} />
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Modelo do veículo"
          placeholder="Ex: Onix, HB20, Argo..."
          error={!!error || !!loadError}
          helperText={error}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {!ready && !loadError ? <CircularProgress color="primary" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  );
}
