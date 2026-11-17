import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { CatalogNavigation } from './CatalogNavigation'
import { PropertySelect } from './PropertySelect'
import { getProperty, listMeters, resourceLabels } from './api'
import type { Meter, Property, ResourceType } from './api'
import { createMeter, updateMeter } from './api'

function PropertyLabel({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['properties', 'detail', id],
    queryFn: ({ signal }) => getProperty(id, signal),
  })
  return (
    <>
      {query.data?.name ??
        (query.isError ? 'Propiedad no disponible' : 'Cargando…')}
    </>
  )
}

export function MetersPage() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Meter | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [serialNumber, setSerialNumber] = useState('')
  const [unit, setUnit] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<unknown>(null)
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const pageSize = 25
  const search = params.get('search') ?? ''
  const propertyId = params.get('propertyId') ?? ''
  const rawResource = params.get('resourceType') ?? ''
  const resourceType =
    rawResource in resourceLabels ? (rawResource as ResourceType) : ''
  const query = useQuery({
    queryKey: [
      'meters',
      'list',
      { page, pageSize, search, propertyId, resourceType },
    ],
    queryFn: ({ signal }) =>
      listMeters(
        {
          page,
          pageSize,
          search,
          propertyId: propertyId || undefined,
          resourceType: resourceType || undefined,
        },
        signal,
      ),
  })
  const close = () => {
    setCreating(false)
    setEditing(null)
    setError(null)
  }
  const mutation = useMutation({
    mutationFn: () =>
      editing
        ? updateMeter(editing.id, { serialNumber: serialNumber.trim(), model })
        : createMeter({
            propertyId: property?.id ?? '',
            serialNumber: serialNumber.trim(),
            resourceType: property?.resourceType ?? 'water',
            unit: unit.trim(),
            model,
          }),
    onSuccess: async () => {
      await client.invalidateQueries()
      close()
    },
    onError: setError,
    retry: false,
  })
  const openNew = () => {
    setProperty(null)
    setSerialNumber('')
    setUnit('')
    setModel('')
    setError(null)
    setCreating(true)
  }
  const openEdit = (meter: Meter) => {
    setEditing(meter)
    setSerialNumber(meter.serialNumber)
    setUnit(meter.unit)
    setModel(meter.model)
    setError(null)
  }
  const updateParams = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / CATÁLOGOS"
        title="Medidores"
        description="Registra equipos asociados a propiedades y administra su serie y modelo."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={openNew}
          >
            Nuevo medidor
          </Button>
        }
      />
      <CatalogNavigation />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Buscar por serie"
            size="small"
            value={search}
            onChange={(event) => updateParams('search', event.target.value)}
            sx={{ minWidth: 240 }}
          />
          <TextField
            select
            label="Recurso"
            size="small"
            value={resourceType}
            onChange={(event) =>
              updateParams('resourceType', event.target.value)
            }
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Todos los recursos</MenuItem>
            {Object.entries(resourceLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ width: { xs: '100%', md: 340 } }}>
            <PropertySelect
              optional
              value={propertyId}
              onChange={(item) => updateParams('propertyId', item?.id ?? '')}
            />
          </Box>
        </Stack>
        {query.isError ? (
          <Stack spacing={2}>
            <ProblemAlert error={query.error} />
            <Button onClick={() => void query.refetch()}>Reintentar</Button>
          </Stack>
        ) : query.isPending ? (
          <Box role="status" aria-label="Cargando medidores">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} height={54} />
            ))}
          </Box>
        ) : query.data.items.length === 0 ? (
          <Typography role="status" color="text.secondary" sx={{ py: 4 }}>
            {search || propertyId || resourceType
              ? 'No hay medidores que coincidan con los filtros.'
              : 'Aún no hay medidores registrados.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table aria-label="Medidores registrados" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Serie</TableCell>
                  <TableCell>Propiedad</TableCell>
                  <TableCell>Recurso</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell>Modelo</TableCell>
                  <TableCell>Instalado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((meter) => (
                  <TableRow key={meter.id} hover>
                    <TableCell>{meter.serialNumber}</TableCell>
                    <TableCell>
                      <PropertyLabel id={meter.propertyId} />
                    </TableCell>
                    <TableCell>{resourceLabels[meter.resourceType]}</TableCell>
                    <TableCell>{meter.unit}</TableCell>
                    <TableCell>{meter.model || 'Sin modelo'}</TableCell>
                    <TableCell>
                      {new Date(meter.installedAt).toLocaleDateString('es-CL', {
                        timeZone: 'America/Santiago',
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={Link}
                        to={`/configuracion/medidores/${meter.id}`}
                      >
                        Detalle
                      </Button>
                      <Button onClick={() => openEdit(meter)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {query.data && (
          <Stack
            direction="row"
            sx={{
              mt: 2,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {query.data.totalCount} medidores · página {query.data.pageNumber}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                disabled={page <= 1 || query.isFetching}
                onClick={() => updateParams('page', String(page - 1))}
              >
                Anterior
              </Button>
              <Button
                disabled={!query.data.hasNextPage || query.isFetching}
                onClick={() => updateParams('page', String(page + 1))}
              >
                Siguiente
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
      <Dialog
        open={creating || !!editing}
        onClose={close}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing ? 'Editar medidor' : 'Nuevo medidor'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            {!editing && (
              <PropertySelect
                value={property?.id ?? ''}
                onChange={setProperty}
              />
            )}
            {editing && (
              <>
                <Typography>
                  Propiedad: <PropertyLabel id={editing.propertyId} />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {resourceLabels[editing.resourceType]} · {editing.unit}. Estos
                  datos no se modifican al editar.
                </Typography>
              </>
            )}
            <TextField
              label="Número de serie"
              required
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            {!editing && (
              <TextField
                label="Unidad"
                required
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                helperText="Por ejemplo, m³ o kWh. Usa la unidad con la que se registra la lectura."
                slotProps={{ htmlInput: { maxLength: 50 } }}
              />
            )}
            <TextField
              label="Modelo (opcional)"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={
              mutation.isPending ||
              !serialNumber.trim() ||
              (!editing && (!property || !unit.trim()))
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Guardando…'
              : editing
                ? 'Guardar cambios'
                : 'Crear medidor'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
