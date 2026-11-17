import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { CatalogNavigation } from './CatalogNavigation'
import {
  getOption,
  getProperty,
  listMeters,
  resourceLabels,
  updateProperty,
} from './api'
import type { ResourceType } from './api'

function RelationshipName({
  kind,
  id,
}: {
  kind: 'organizations' | 'condominiums'
  id: string
}) {
  const query = useQuery({
    queryKey: [kind, 'detail', id],
    queryFn: ({ signal }) => getOption(kind, id, signal),
  })
  return (
    <>{query.data?.name ?? (query.isError ? 'No disponible' : 'Cargando…')}</>
  )
}

export function PropertyDetailPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const [meterPage, setMeterPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<unknown>(null)
  const property = useQuery({
    queryKey: ['properties', 'detail', id],
    queryFn: ({ signal }) => getProperty(id, signal),
    enabled: !!id,
  })
  const meters = useQuery({
    queryKey: ['meters', 'property', id, meterPage],
    queryFn: ({ signal }) =>
      listMeters({ page: meterPage, pageSize: 25, propertyId: id }, signal),
    enabled: !!id,
  })
  const mutation = useMutation({
    mutationFn: () =>
      updateProperty(id, { name: name.trim(), address: address.trim() }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['properties'] }),
        client.invalidateQueries({ queryKey: ['meters'] }),
      ])
      setEditing(false)
    },
    onError: setError,
    retry: false,
  })
  const openEdit = () => {
    setName(property.data?.name ?? '')
    setAddress(property.data?.address ?? '')
    setError(null)
    setEditing(true)
  }
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / PROPIEDADES"
        title={property.data?.name ?? 'Detalle de propiedad'}
        description="Consulta la pertenencia, recurso y medidores de este lugar."
        action={
          <Button
            component={Link}
            to="/configuracion/propiedades"
            startIcon={<ArrowBackRounded />}
          >
            Volver a propiedades
          </Button>
        }
      />
      <CatalogNavigation />
      {property.isError ? (
        <ProblemAlert error={property.error} />
      ) : property.isPending ? (
        <Skeleton height={180} />
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <div>
                <Typography variant="h6" component="h2">
                  Datos de la propiedad
                </Typography>
                <Typography sx={{ mt: 1 }}>{property.data.address}</Typography>
                <Typography sx={{ mt: 1 }}>
                  Recurso:{' '}
                  {resourceLabels[property.data.resourceType as ResourceType]}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  Organización:{' '}
                  {property.data.organizationId ? (
                    <RelationshipName
                      kind="organizations"
                      id={property.data.organizationId}
                    />
                  ) : (
                    'Independiente'
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Condominio:{' '}
                  {property.data.condominiumId ? (
                    <RelationshipName
                      kind="condominiums"
                      id={property.data.condominiumId}
                    />
                  ) : (
                    'Sin condominio'
                  )}
                </Typography>
              </div>
              <Button
                variant="outlined"
                onClick={openEdit}
                sx={{ alignSelf: { sm: 'flex-start' } }}
              >
                Editar nombre y dirección
              </Button>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ mb: 2, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h6" component="h2">
                  Medidores
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Los medidores conservan el recurso y la unidad de esta
                  propiedad.
                </Typography>
              </Box>
              <Button
                component={Link}
                to={`/configuracion/medidores?propertyId=${id}`}
                variant="outlined"
              >
                Administrar medidores
              </Button>
            </Stack>
            {meters.isError ? (
              <Stack spacing={1}>
                <ProblemAlert error={meters.error} />
                <Button
                  onClick={() => void meters.refetch()}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Reintentar
                </Button>
              </Stack>
            ) : meters.isPending ? (
              <Skeleton height={80} />
            ) : meters.data.items.length === 0 ? (
              <Alert severity="info">
                Esta propiedad aún no tiene medidores.
              </Alert>
            ) : (
              <TableContainer>
                <Table aria-label="Medidores de la propiedad">
                  <TableHead>
                    <TableRow>
                      <TableCell>Serie</TableCell>
                      <TableCell>Recurso</TableCell>
                      <TableCell>Unidad</TableCell>
                      <TableCell>Modelo</TableCell>
                      <TableCell>Instalado</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {meters.data.items.map((meter) => (
                      <TableRow key={meter.id}>
                        <TableCell>{meter.serialNumber}</TableCell>
                        <TableCell>
                          {resourceLabels[meter.resourceType]}
                        </TableCell>
                        <TableCell>{meter.unit}</TableCell>
                        <TableCell>{meter.model || 'Sin modelo'}</TableCell>
                        <TableCell>
                          {new Date(meter.installedAt).toLocaleDateString(
                            'es-CL',
                            { timeZone: 'America/Santiago' },
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            component={Link}
                            to={`/lecturas?meterId=${meter.id}`}
                          >
                            Ver lecturas
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {meters.data && (
              <Stack direction="row">
                <Button
                  disabled={meterPage <= 1}
                  onClick={() => setMeterPage(meterPage - 1)}
                >
                  Medidores anteriores
                </Button>
                <Typography sx={{ p: 1 }}>
                  Página {meterPage} · {meters.data.totalCount} medidores
                </Typography>
                <Button
                  disabled={!meters.data.hasNextPage}
                  onClick={() => setMeterPage(meterPage + 1)}
                >
                  Más medidores
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      )}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar propiedad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            <TextField
              label="Nombre"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Dirección"
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <Typography variant="body2" color="text.secondary">
              El recurso y las pertenencias no se editan para conservar el
              significado del historial.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditing(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={mutation.isPending || !name.trim() || !address.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
