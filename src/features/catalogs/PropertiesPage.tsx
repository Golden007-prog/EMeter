import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined'
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import LocalFireDepartmentOutlined from '@mui/icons-material/LocalFireDepartmentOutlined'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { CatalogSelect } from './CatalogSelect'
import { CatalogNavigation } from './CatalogNavigation'
import { CreatePropertyDialog } from './CreatePropertyDialog'
import { getOption, listProperties, resourceLabels } from './api'
import type { Property, ResourceType } from './api'

const resourceIcons = {
  water: WaterDropOutlined,
  electricity: BoltOutlined,
  gas: LocalFireDepartmentOutlined,
}
function ResourceBadge({ type }: { type: ResourceType }) {
  const Icon = resourceIcons[type]
  return (
    <Chip
      size="small"
      className={`resource resource-${type}`}
      icon={<Icon />}
      label={resourceLabels[type]}
    />
  )
}
function Ownership({ property }: { property: Property }) {
  const condominium = useQuery({
    queryKey: ['condominiums', 'detail', property.condominiumId],
    queryFn: ({ signal }) =>
      getOption('condominiums', property.condominiumId!, signal),
    enabled: !!property.condominiumId,
  })
  const organization = useQuery({
    queryKey: ['organizations', 'detail', property.organizationId],
    queryFn: ({ signal }) =>
      getOption('organizations', property.organizationId!, signal),
    enabled: !!property.organizationId,
  })
  if (!property.condominiumId && !property.organizationId)
    return <Chip label="Independiente" variant="outlined" size="small" />
  return (
    <Box>
      {property.condominiumId && (
        <Typography variant="body2">
          {condominium.data?.name ??
            (condominium.isError
              ? 'Condominio no disponible'
              : 'Cargando condominio…')}
        </Typography>
      )}
      {property.organizationId && (
        <Typography
          variant="body2"
          color={property.condominiumId ? 'text.secondary' : 'text.primary'}
        >
          {organization.data?.name ??
            (organization.isError
              ? 'Organización no disponible'
              : 'Cargando organización…')}
        </Typography>
      )}
    </Box>
  )
}

export function PropertiesPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Property | null>(null)
  const rawPage = Number(params.get('page') ?? 1)
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, 2147483647)
      : 1
  const rawSize = Number(params.get('pageSize') ?? 10)
  const pageSize = [10, 25, 50].includes(rawSize) ? rawSize : 10
  const search = params.get('search') ?? ''
  const organizationId = params.get('organizationId') ?? ''
  const condominiumId = params.get('condominiumId') ?? ''
  const filters = { page, pageSize, search, organizationId, condominiumId }
  const query = useQuery({
    queryKey: ['properties', filters],
    queryFn: ({ signal }) => listProperties(filters, signal),
  })
  const data = query.data
  const filtered = !!(search || organizationId || condominiumId)
  function update(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    next.set('page', '1')
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next)
  }
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / CATÁLOGOS"
        title="Propiedades"
        description="Organiza tus propiedades y los servicios que vas a medir."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => setCreating(true)}
          >
            Nueva propiedad
          </Button>
        }
      />
      <CatalogNavigation />
      {created && (
        <Alert
          severity="success"
          onClose={() => setCreated(null)}
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              onClick={() =>
                update({
                  search: created.name,
                  organizationId: undefined,
                  condominiumId: undefined,
                })
              }
            >
              Buscar creada
            </Button>
          }
        >
          Se creó «{created.name}». La lista se actualizó; la propiedad puede
          aparecer en otra página o fuera de los filtros actuales.
        </Alert>
      )}
      <Paper className="properties-panel" variant="outlined">
        <Box className="panel-heading">
          <Box>
            <Typography component="h2" variant="h6">
              Directorio de propiedades
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Casas, departamentos y espacios con suministro.
            </Typography>
          </Box>
          <Chip
            variant="outlined"
            label={
              data
                ? `${data.totalCount.toLocaleString('es-CL')} ${data.totalCount === 1 ? 'propiedad' : 'propiedades'}`
                : 'Propiedades'
            }
          />
        </Box>
        <Box className="filter-bar">
          <Box
            key={search}
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              update({ search: String(form.get('search') ?? '').trim() })
            }}
            className="search-form"
          >
            <TextField
              name="search"
              label="Buscar por nombre"
              defaultValue={search}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="outlined">
              Buscar
            </Button>
          </Box>
          <CatalogSelect
            id="filter-organization"
            kind="organizations"
            label="Organización"
            value={organizationId}
            onChange={(item) =>
              update({ organizationId: item?.id, condominiumId: undefined })
            }
          />
          <CatalogSelect
            id="filter-condominium"
            kind="condominiums"
            label="Condominio"
            value={condominiumId}
            organizationId={organizationId || undefined}
            onChange={(item) => update({ condominiumId: item?.id })}
          />
        </Box>
        {filtered && (
          <Box sx={{ px: 3, pb: 2 }}>
            <Button
              size="small"
              onClick={() =>
                update({
                  search: undefined,
                  organizationId: undefined,
                  condominiumId: undefined,
                })
              }
            >
              Limpiar filtros
            </Button>
          </Box>
        )}
        <Box aria-busy={query.isFetching}>
          {query.isError ? (
            <Stack spacing={2} sx={{ p: 3 }}>
              <ProblemAlert error={query.error} />
              <Button
                variant="outlined"
                onClick={() => void query.refetch()}
                sx={{ alignSelf: 'flex-start' }}
              >
                Reintentar
              </Button>
            </Stack>
          ) : query.isPending ? (
            <Box sx={{ p: 3 }} role="status" aria-label="Cargando propiedades">
              <Typography sx={{ mb: 2 }}>Cargando propiedades…</Typography>
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} height={64} />
              ))}
            </Box>
          ) : !data?.items.length ? (
            <Box className="empty-state" role="status">
              <HomeWorkOutlined
                sx={{ fontSize: 44, color: 'primary.main', mb: 2 }}
              />
              <Typography variant="h6" component="h3">
                {page > 1
                  ? 'No hay propiedades en esta página'
                  : filtered
                    ? 'No encontramos propiedades'
                    : 'Tu primera propiedad empieza aquí'}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ mt: 1, mb: 3, maxWidth: 460 }}
              >
                {filtered
                  ? 'Prueba otro nombre o cambia los filtros de búsqueda.'
                  : 'Agrega una casa, departamento o espacio para comenzar a organizar tus medidores.'}
              </Typography>
              {page > 1 ? (
                <Button onClick={() => update({ page: '1' })}>
                  Ir a la primera página
                </Button>
              ) : (
                <Button variant="outlined" onClick={() => setCreating(true)}>
                  Crear una propiedad
                </Button>
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table
                aria-label="Propiedades registradas"
                sx={{ minWidth: 660 }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Propiedad</TableCell>
                    <TableCell>Recurso</TableCell>
                    <TableCell>Pertenencia</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((property) => (
                    <TableRow key={property.id} hover>
                      <TableCell>
                        <Stack
                          direction="row"
                          sx={{ alignItems: 'center' }}
                          spacing={2}
                        >
                          <Box className="property-icon">
                            <HomeWorkOutlined fontSize="small" />
                          </Box>
                          <Box>
                            <Typography
                              component={Link}
                              to={`/configuracion/propiedades/${property.id}${location.search}`}
                              variant="subtitle2"
                              sx={{
                                color: 'primary.main',
                                textDecoration: 'none',
                              }}
                            >
                              {property.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {property.address}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <ResourceBadge type={property.resourceType} />
                      </TableCell>
                      <TableCell>
                        <Ownership property={property} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
        {data && !query.isError && (
          <Box className="pagination-bar">
            <Typography variant="body2" color="text.secondary" role="status">
              {data.totalCount === 0
                ? '0 resultados'
                : `Página ${data.pageNumber} · ${data.totalCount.toLocaleString('es-CL')} resultados`}
              {query.isFetching && (
                <CircularProgress
                  size={12}
                  sx={{ ml: 1 }}
                  aria-label="Actualizando lista"
                />
              )}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                select
                label="Por página"
                size="small"
                value={pageSize}
                sx={{ minWidth: 100 }}
                onChange={(event) => update({ pageSize: event.target.value })}
              >
                {[10, 25, 50].map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={page <= 1 || query.isFetching}
                onClick={() => update({ page: String(page - 1) })}
              >
                Anterior
              </Button>
              <Button
                disabled={!data.hasNextPage || query.isFetching}
                onClick={() => update({ page: String(page + 1) })}
              >
                Siguiente
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
      <Box className="info-note">
        <HomeWorkOutlined fontSize="small" />
        <Typography variant="body2">
          Una propiedad puede ser independiente o pertenecer a una organización
          o condominio. Después podrás asociar sus medidores.
        </Typography>
      </Box>
      {creating && (
        <CreatePropertyDialog
          open
          onClose={() => setCreating(false)}
          onCreated={setCreated}
        />
      )}
    </>
  )
}
