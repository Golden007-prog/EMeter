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
import { OrganizationsPage } from '../features/catalogs/OrganizationsPage'
import { CondominiumsPage } from '../features/catalogs/CondominiumsPage'
import { CondominiumDetailPage } from '../features/catalogs/CondominiumDetailPage'
import { MetersPage } from '../features/catalogs/MetersPage'
import { PropertyDetailPage } from '../features/catalogs/PropertyDetailPage'
import { BillingPeriodsPage } from '../features/catalogs/BillingPeriodsPage'
import { PeriodWorkspacePage } from '../features/period-workspace/PeriodWorkspacePage'
import { ReadingsPage } from '../features/readings/ReadingsPage'
import { DocumentsPage } from '../features/documents/DocumentsPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { ReadingDetailPage } from '../features/readings/ReadingDetailPage'
import { Layout } from './Layout'
import { DocumentDetailPage } from '../features/documents/DocumentDetailPage'
import {
  OrganizationDetailPage,
  MeterDetailPage,
} from '../features/catalogs/CatalogDetailPages'
import { SystemPage } from '../features/catalogs/SystemPage'
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
function PeriodRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/periodo${search}`} replace />
}
export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<PeriodRedirect />} />
              <Route path="configuracion" element={<PropertiesRedirect />} />
              <Route
                path="configuracion/organizaciones"
                element={<OrganizationsPage />}
              />
              <Route
                path="configuracion/condominios"
                element={<CondominiumsPage />}
              />
              <Route
                path="configuracion/condominios/:id"
                element={<CondominiumDetailPage />}
              />
              <Route
                path="configuracion/propiedades"
                element={<PropertiesPage />}
              />
              <Route
                path="configuracion/propiedades/:id"
                element={<PropertyDetailPage />}
              />
              <Route path="configuracion/medidores" element={<MetersPage />} />
              <Route
                path="configuracion/periodos"
                element={<BillingPeriodsPage />}
              />
              <Route path="periodo" element={<PeriodWorkspacePage />} />
              <Route path="lecturas" element={<ReadingsPage />} />
              <Route path="lecturas/:id" element={<ReadingDetailPage />} />
              <Route path="documentos" element={<DocumentsPage />} />
              <Route path="documentos/:id" element={<DocumentDetailPage />} />
              <Route
                path="configuracion/organizaciones/:id"
                element={<OrganizationDetailPage />}
              />
              <Route
                path="configuracion/medidores/:id"
                element={<MeterDetailPage />}
              />
              <Route path="configuracion/sistema" element={<SystemPage />} />
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
