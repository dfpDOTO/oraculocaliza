import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, TextField, Box, Typography, CircularProgress } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import { searchStores, ensureStoresLoaded } from '../services/storeService';
import type { Store } from '../types';

interface Props {
  value: Store | null;
  onChange: (store: Store | null) => void;
  error?: string;
}

export default function DestinationAutocomplete({ value, onChange, error }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    ensureStoresLoaded()
      .then(() => setReady(true))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar lojas.'));
  }, []);

  const options = useMemo(() => (ready ? searchStores(inputValue) : []), [inputValue, ready]);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      getOptionLabel={(o) => (o ? `${o.code} — ${o.name}` : '')}
      isOptionEqualToValue={(o, v) => o.code === v.code}
      noOptionsText={
        loadError ? loadError : !ready ? 'Carregando lojas...' : inputValue.length === 0 ? 'Digite para buscar (ex: "nau")' : 'Nenhuma loja encontrada'
      }
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.code} sx={{ display: 'flex !important', flexDirection: 'column', alignItems: 'flex-start !important', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaceIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="body1" fontWeight={700}>{option.code}</Typography>
            <Typography variant="body2" color="text.secondary">— {option.name}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5 }}>
            {option.address}{option.neighborhood ? `, ${option.neighborhood}` : ''}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Destino"
          placeholder='Digite o código ou bairro (ex: "nau")'
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
