import { createTheme } from '@mui/material/styles'
import { esES } from '@mui/material/locale'

export const theme = createTheme(
  {
    palette: {
      primary: { main: '#147568', dark: '#0d594e' },
      secondary: { main: '#142d36' },
      background: { default: '#f5f7f8', paper: '#ffffff' },
      text: { primary: '#1c323b', secondary: '#596b73' },
      divider: '#e2e8eb',
    },
    typography: {
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
      h4: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-.7px' },
      h6: { fontSize: '1.06rem', fontWeight: 650 },
      subtitle2: { fontWeight: 650 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 40 },
          contained: { paddingInline: 18 },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            background: '#f8fafb',
            color: '#52666f',
            fontWeight: 600,
            fontSize: '.77rem',
          },
          root: { padding: '20px 24px', borderColor: '#eaf0f2' },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 6, fontSize: '.75rem' } },
      },
      MuiDialog: { defaultProps: { fullWidth: true } },
    },
  },
  esES,
)
