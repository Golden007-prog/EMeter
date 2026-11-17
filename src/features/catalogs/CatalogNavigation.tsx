import { NavLink, useSearchParams } from 'react-router-dom'

const catalogs = [
  { to: '/configuracion/organizaciones', label: 'Organizaciones' },
  { to: '/configuracion/condominios', label: 'Condominios' },
  { to: '/configuracion/propiedades', label: 'Propiedades' },
  { to: '/configuracion/medidores', label: 'Medidores' },
  { to: '/configuracion/periodos', label: 'Períodos' },
  { to: '/configuracion/sistema', label: 'Sistema' },
]

export function CatalogNavigation() {
  const [params] = useSearchParams()
  const period = params.get('billingPeriodId')
  const search = period ? `?billingPeriodId=${encodeURIComponent(period)}` : ''
  return (
    <nav className="catalog-tabs" aria-label="Catálogos de configuración">
      {catalogs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={`${to}${search}`}
          end
          className={({ isActive }) =>
            `catalog-tab-link${isActive ? ' catalog-tab-active' : ''}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
