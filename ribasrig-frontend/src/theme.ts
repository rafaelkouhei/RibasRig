import { createTheme } from '@mui/material/styles';

// Identidade do login do Victor: Exo 2, azul-ardósia, cantos retos.
export const cores = {
  marinho: '#34446A',
  azul: '#4A6192',
  botao: '#3F4D6E',
  claro: '#BCC6DA',
  fundo: '#ECEEF2',
  alerta: '#C2610C',
  alertaFundo: '#FBE1C6',
  texto: '#1F2A40',
  textoSecundario: '#5A6478',
  borda: '#D5DAE3',
};

export const tema = createTheme({
  palette: {
    primary: { main: cores.marinho, light: cores.azul, contrastText: '#FFFFFF' },
    secondary: { main: cores.azul },
    warning: { main: cores.alerta, light: cores.alertaFundo },
    // Erros de campo em laranja-escuro (contraste 6:1 sobre branco), como no protótipo.
    error: { main: '#9A4A08', contrastText: '#FFFFFF' },
    background: { default: cores.fundo, paper: '#FFFFFF' },
    text: { primary: cores.texto, secondary: cores.textoSecundario },
    divider: cores.borda,
  },
  shape: { borderRadius: 3 },
  typography: {
    fontFamily: "'Exo 2', system-ui, sans-serif",
    h1: { fontSize: '2rem', fontWeight: 600, color: cores.marinho },
    h2: { fontSize: '1.25rem', fontWeight: 600, color: cores.marinho },
    h3: { fontSize: '1rem', fontWeight: 600, color: cores.marinho },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44, paddingInline: 18 } },
      variants: [{ props: { variant: 'contained', color: 'primary' }, style: { backgroundColor: cores.botao, '&:hover': { backgroundColor: cores.marinho } } }],
    },
    // Legenda sempre na borda, como os campos do login do Victor
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiInputLabel: { defaultProps: { shrink: true }, styleOverrides: { root: { color: cores.marinho, '&.Mui-focused': { color: cores.azul } } } },
    MuiOutlinedInput: {
      defaultProps: { notched: true },
      styleOverrides: {
        root: { backgroundColor: '#FFFFFF', '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: cores.azul }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: cores.azul, boxShadow: '0 0 0 3px #D6DCE8' } },
        notchedOutline: { borderColor: '#8F9AB0', borderWidth: 1.5 },
        input: { fontSize: 15 },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: `1px solid ${cores.borda}` } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, fontSize: 12, color: '#3A465E', backgroundColor: '#EEF0F4' } } },
  },
});
