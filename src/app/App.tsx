import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CssBaseline, ThemeProvider } from '@mui/material'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { ApiError } from '../shared/api/client'
import { UpcomingPage } from '../shared/ui/UpcomingPage'
import { PropertiesPage } from '../features/catalogs/PropertiesPage'
import { PeriodWorkspacePage } from '../features/period-workspace/PeriodWorkspacePage'
import { ReadingsPage } from '../features/readings/ReadingsPage'
import { DocumentsPage } from '../features/documents/DocumentsPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { Layout } from './Layout'
import { theme } from './theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        count < 1 &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
})
function PropertiesRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/configuracion/propiedades${search}`} replace />
}
export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<PropertiesRedirect />} />
              <Route path="configuracion" element={<PropertiesRedirect />} />
              <Route
                path="configuracion/propiedades"
                element={<PropertiesPage />}
              />
              <Route path="periodo" element={<PeriodWorkspacePage />} />
              <Route path="lecturas" element={<ReadingsPage />} />
              <Route path="documentos" element={<DocumentsPage />} />
              <Route path="reportes" element={<ReportsPage />} />
              <Route
                path="*"
                element={
                  <UpcomingPage
                    title="Página no encontrada"
                    description="Esta dirección no corresponde a una pantalla de UtilityMeter."
                    detail="Puedes volver al directorio de propiedades desde el siguiente enlace o usar la navegación lateral."
                  />
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
