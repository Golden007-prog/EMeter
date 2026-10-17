import { useEffect, useRef, useState } from 'react'
import {
  Link as RouterLink,
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { Box, Chip, Drawer, IconButton, Typography } from '@mui/material'
import DashboardOutlined from '@mui/icons-material/DashboardOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import BarChartOutlined from '@mui/icons-material/BarChartOutlined'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined'
import MenuRounded from '@mui/icons-material/MenuRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'

const links = [
  { to: '/periodo', label: 'Resumen del período', icon: DashboardOutlined },
  { to: '/lecturas', label: 'Lecturas', icon: SpeedOutlined },
  { to: '/documentos', label: 'Documentos / OCR', icon: DescriptionOutlined },
  { to: '/reportes', label: 'Reportes', icon: BarChartOutlined },
  {
    to: '/configuracion/propiedades',
    label: 'Configuración',
    icon: SettingsOutlined,
  },
]
export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (previousPath.current !== location.pathname) mainRef.current?.focus()
    previousPath.current = location.pathname
    document.title = `UtilityMeter · ${links.find((link) => location.pathname.startsWith(link.to))?.label ?? 'Página no encontrada'}`
  }, [location.pathname])
  const params = new URLSearchParams(location.search)
  const period = params.get('billingPeriodId')
  const periodSearch = period
    ? `?${new URLSearchParams({ billingPeriodId: period })}`
    : ''
  const sidebar = (
    <Box className="sidebar-content">
      <RouterLink
        className="brand"
        to={`/configuracion/propiedades${periodSearch}`}
        onClick={() => setMobileOpen(false)}
      >
        <Box className="brand-symbol">
          <WaterDropOutlined />
        </Box>
        <span>
          UtilityMeter
          <span className="brand-subtitle">Control de servicios</span>
        </span>
      </RouterLink>
      <Typography className="sidebar-caption">ESPACIO DE TRABAJO</Typography>
      <nav aria-label="Navegación principal">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${to}${to === '/configuracion/propiedades' && location.pathname === to ? location.search : periodSearch}`}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Icon fontSize="small" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Box className="sidebar-footer">
        <span className="local-dot" />
        <Box>
          <Typography variant="body2">Prototipo local</Typography>
          <Typography variant="caption">
            Un usuario · Sin autenticación
          </Typography>
        </Box>
      </Box>
    </Box>
  )
  return (
    <Box className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <Box component="aside" className="desktop-sidebar">
        {sidebar}
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: 264, background: '#142d36' } }}
      >
        <IconButton
          aria-label="Cerrar navegación"
          onClick={() => setMobileOpen(false)}
          sx={{ color: 'white', position: 'absolute', right: 8, top: 8 }}
        >
          <CloseRounded />
        </IconButton>
        {sidebar}
      </Drawer>
      <Box className="main-shell">
        <Box component="header" className="topbar">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              aria-label="Abrir navegación"
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
            >
              <MenuRounded />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              Gestión de servicios <span className="topbar-separator">/</span>{' '}
              <strong>Tu espacio de trabajo</strong>
            </Typography>
          </Box>
          <Chip size="small" variant="outlined" label="Entorno local" />
        </Box>
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          ref={mainRef}
          className="main-content"
        >
          <Outlet />
        </Box>
        <Box component="footer" className="main-footer">
          <Typography variant="caption">
            UtilityMeter · Agua, electricidad y gas
          </Typography>
          <Typography variant="caption">
            Zona horaria: America/Santiago
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
