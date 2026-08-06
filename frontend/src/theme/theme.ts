import { createTheme } from '@mui/material/styles';

// ============================================================
// Paleta OrácuLocaliza — extraída diretamente da logo oficial
//   #141C1C  Grafite profundo (fundo base)
//   #1B2424  Grafite elevado (cards / painéis)
//   #232E2E  Grafite elevado 2 (hover / inputs)
//   #79DD22  Verde da marca (ação primária)
//   #9CEB5C  Verde claro (destaque / hover)
//   #F5F7F6  Branco quase puro (texto principal)
//   #96A0A0  Cinza esverdeado (texto secundário)
// ============================================================

export const palette = {
  graphite: '#141C1C',
  graphiteElevated: '#1B2424',
  graphiteElevated2: '#232E2E',
  green: '#79DD22',
  greenLight: '#9CEB5C',
  white: '#F5F7F6',
  grayText: '#96A0A0',
  danger: '#FF5A5F',
  warning: '#FFB020'
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: palette.green, light: palette.greenLight, contrastText: '#141C1C' },
    secondary: { main: palette.greenLight },
    background: { default: palette.graphite, paper: palette.graphiteElevated },
    text: { primary: palette.white, secondary: palette.grayText },
    error: { main: palette.danger },
    warning: { main: palette.warning },
    divider: 'rgba(255,255,255,0.08)'
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: '"Inter", "Manrope", system-ui, sans-serif',
    h1: { fontFamily: '"Manrope", sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Manrope", sans-serif', fontWeight: 800 },
    h3: { fontFamily: '"Manrope", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Manrope", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Manrope", sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Manrope", sans-serif', fontWeight: 600 },
    button: { fontFamily: '"Manrope", sans-serif', fontWeight: 700, textTransform: 'none' }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          padding: '10px 20px',
          transition: 'all 180ms ease'
        },
        containedPrimary: {
          boxShadow: '0 6px 20px rgba(121,221,34,0.35)',
          '&:hover': {
            boxShadow: '0 8px 28px rgba(121,221,34,0.5)',
            transform: 'translateY(-1px)'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          backgroundColor: palette.graphiteElevated,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          transition: 'transform 180ms ease, box-shadow 180ms ease',
          '&:hover': {
            boxShadow: '0 14px 40px rgba(0,0,0,0.45)'
          }
        }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: palette.graphiteElevated2
        }
      }
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 10, fontWeight: 600 } }
    }
  }
});

export default theme;
