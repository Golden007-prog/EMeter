import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { CatalogNavigation } from './CatalogNavigation'
import {
  getOption,
  listMetersForCondominium,
  setCondominiumMainMeter,
} from './api'

export function CondominiumDetailPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const [selectedMeterId, setSelectedMeterId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const condominium = useQuery({
    queryKey: ['condominiums', 'detail', id],
    queryFn: ({ signal }) => getOption('condominiums', id, signal),
    enabled: !!id,
  })
  const candidates = useQuery({
    queryKey: ['condominiums', id, 'main-meter-candidates'],
    queryFn: ({ signal }) => listMetersForCondominium(id, signal),
    enabled: !!id,
  })
  const assign = useMutation({
    mutationFn: (meterId: string) => setCondominiumMainMeter(id, meterId),
    onSuccess: async () => {
      setError(null)
      setSelectedMeterId('')
      await client.invalidateQueries()
    },
    onError: setError,
    retry: false,
  })
  const details =
    condominium.data && 'mainMeterId' in condominium.data
      ? condominium.data
      : null
  const organization = useQuery({
    queryKey: ['organizations', 'detail', details?.organizationId],
    queryFn: ({ signal }) =>
      getOption('organizations', details?.organizationId ?? '', signal),
    enabled: !!details?.organizationId,
  })
  const assigned = candidates.data?.find(
    ({ meter }) => meter.id === details?.mainMeterId,
  )
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / CONDOMINIOS"
        title={details?.name ?? 'Detalle del condominio'}
        description="Revisa su pertenencia y asigna el medidor principal entre los medidores de sus propiedades."
        action={
          <Button
            component={Link}
            to="/configuracion/condominios"
            startIcon={<ArrowBackRounded />}
          >
            Volver a condominios
          </Button>
        }
      />
      <CatalogNavigation />
      {condominium.isError ? (
        <ProblemAlert error={condominium.error} />
      ) : condominium.isPending ? (
        <Skeleton height={160} />
      ) : !details ? (
        <Alert severity="error">
          La respuesta no contiene un detalle de condominio válido.
        </Alert>
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" component="h2">
              Datos del condominio
            </Typography>
            <Typography sx={{ mt: 1 }}>{details.address}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Organización:{' '}
              {details.organizationId
                ? (organization.data?.name ??
                  (organization.isError ? 'No disponible' : 'Cargando…'))
                : 'Independiente'}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" component="h2">
              Medidor principal
            </Typography>
            {assigned ? (
              <Typography sx={{ mt: 1 }}>
                {assigned.meter.serialNumber} · {assigned.propertyName} ·{' '}
                {assigned.meter.unit}
              </Typography>
            ) : (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {details.mainMeterId
                  ? 'El medidor principal actual no aparece entre los candidatos disponibles.'
                  : 'No hay un medidor principal asignado.'}
              </Typography>
            )}
            {candidates.isError ? (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <ProblemAlert error={candidates.error} />
                <Button
                  onClick={() => void candidates.refetch()}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Volver a cargar medidores
                </Button>
              </Stack>
            ) : candidates.isPending ? (
              <Box role="status" sx={{ mt: 2 }}>
                <Skeleton height={56} />
              </Box>
            ) : candidates.data.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Este condominio todavía no tiene medidores en sus propiedades.
              </Alert>
            ) : (
              <Stack spacing={1.5} sx={{ mt: 2, maxWidth: 560 }}>
                {Boolean(error) && <ProblemAlert error={error} />}
                <TextField
                  select
                  label="Medidor de una propiedad del condominio"
                  value={selectedMeterId}
                  onChange={(event) => setSelectedMeterId(event.target.value)}
                  helperText="La asignación reemplaza el principal actual. La API no ofrece una acción para quitarlo sin sustituirlo."
                >
                  <MenuItem value="">Selecciona un medidor</MenuItem>
                  {candidates.data.map(({ meter, propertyName }) => (
                    <MenuItem key={meter.id} value={meter.id}>
                      {meter.serialNumber} · {propertyName} · {meter.unit}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  disabled={
                    !selectedMeterId ||
                    assign.isPending ||
                    selectedMeterId === details.mainMeterId
                  }
                  onClick={() => assign.mutate(selectedMeterId)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {assign.isPending ? 'Asignando…' : 'Asignar como principal'}
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      )}
    </>
  )
}
