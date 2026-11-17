import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { PropertySelect } from '../catalogs/PropertySelect'
import { BillingPeriodSelect, MeterSelect } from './ReadingSelectors'
import { CreateReadingDialog } from './CreateReadingDialog'
import {
  listReadingsByMeter,
  listReadingsByPeriod,
  listReadingsByProperty,
} from './api'
import type { Reading } from './api'
import { decimalText } from '../../shared/lib/decimal'

const sourceLabels = {
  Manual: 'Captura manual',
  Resident: 'Informada por residente',
  Company: 'Informada por empresa',
  OCR: 'Propuesta de extracción OCR',
} as const
const statusLabels = {
  Pending: 'Pendiente de revisión',
  Confirmed: 'Confirmada',
  Rejected: 'Rechazada',
  Voided: 'Anulada',
} as const
const contextModes = [
  { value: 'meter', label: 'Por medidor' },
  { value: 'property', label: 'Por propiedad' },
  { value: 'period', label: 'Por período' },
] as const
type ContextMode = (typeof contextModes)[number]['value']

function ReadingRow({ reading }: { reading: Reading }) {
  return (
    <TableRow hover>
      <TableCell>
        <Button
          component={Link}
          to={`/lecturas/${reading.id}`}
          sx={{ textTransform: 'none' }}
        >
          {new Date(reading.measuredAt).toLocaleString('es-CL', {
            timeZone: 'America/Santiago',
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Button>
      </TableCell>
      <TableCell>
        {decimalText(reading.value)} {reading.unit}
      </TableCell>
      <TableCell>{sourceLabels[reading.source]}</TableCell>
      <TableCell>
        <Chip
          size="small"
          label={statusLabels[reading.reviewStatus]}
          color={
            reading.reviewStatus === 'Confirmed'
              ? 'success'
              : reading.reviewStatus === 'Rejected' ||
                  reading.reviewStatus === 'Voided'
                ? 'default'
                : 'warning'
          }
        />
      </TableCell>
      <TableCell>
        {reading.status === 'Warning' || reading.alerts.length > 0 ? (
          <Chip
            size="small"
            color="warning"
            label={`Advertencia${reading.alerts.length ? ` · ${reading.alerts.length}` : ''}`}
          />
        ) : (
          'Sin advertencias'
        )}
      </TableCell>
    </TableRow>
  )
}

export function ReadingsPage() {
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(params.get('capture') === '1')
  const [created, setCreated] = useState<Reading | null>(null)
  const rawMode = params.get('by')
  const mode: ContextMode = contextModes.some((item) => item.value === rawMode)
    ? (rawMode as ContextMode)
    : params.has('meterId')
      ? 'meter'
      : params.has('propertyId')
        ? 'property'
        : 'period'
  const meterId = params.get('meterId') ?? ''
  const propertyId = params.get('propertyId') ?? ''
  const periodId = params.get('billingPeriodId') ?? ''
  const activeId =
    mode === 'meter' ? meterId : mode === 'property' ? propertyId : periodId
  const query = useQuery({
    queryKey: ['readings', 'list', mode, activeId],
    queryFn: ({ signal }) =>
      mode === 'meter'
        ? listReadingsByMeter(activeId, signal)
        : mode === 'property'
          ? listReadingsByProperty(activeId, signal)
          : listReadingsByPeriod(activeId, signal),
    enabled: !!activeId,
  })
  const updateContext = (nextMode: ContextMode, id: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      next.delete('meterId')
      next.delete('propertyId')
      if (nextMode === 'period') next.delete('billingPeriodId')
      next.set('by', nextMode)
      if (id)
        next.set(
          nextMode === 'meter'
            ? 'meterId'
            : nextMode === 'property'
              ? 'propertyId'
              : 'billingPeriodId',
          id,
        )
      return next
    })
  const sorted = query.data
    ?.slice()
    .sort(
      (a, b) =>
        new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    )
  return (
    <>
      <PageHeading
        eyebrow="LECTURAS / REGISTRO Y REVISIÓN"
        title="Lecturas"
        description="Consulta mediciones por medidor, propiedad o período, y registra nuevas lecturas acumuladas."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => {
              setCreated(null)
              setCreating(true)
            }}
          >
            Nueva lectura
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ mb: 2, alignItems: { md: 'flex-start' } }}
        >
          <TextField
            select
            label="Consultar"
            value={mode}
            onChange={(event) =>
              updateContext(event.target.value as ContextMode, '')
            }
            sx={{ minWidth: 180 }}
          >
            {contextModes.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          {mode === 'meter' && (
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <MeterSelect
                value={meterId}
                onChange={(item) => updateContext('meter', item?.id ?? '')}
              />
            </Box>
          )}
          {mode === 'property' && (
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <PropertySelect
                value={propertyId}
                onChange={(item) => updateContext('property', item?.id ?? '')}
              />
            </Box>
          )}
          {mode === 'period' && (
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <BillingPeriodSelect
                value={periodId}
                onChange={(item) => updateContext('period', item?.id ?? '')}
              />
            </Box>
          )}
        </Stack>
        {created && (
          <Alert severity="success" onClose={() => setCreated(null)}>
            Lectura guardada. Versión {created.version}; advertencias:{' '}
            {created.alerts.length}.
          </Alert>
        )}
        {!activeId ? (
          <Typography role="status" color="text.secondary" sx={{ py: 5 }}>
            Selecciona un{' '}
            {mode === 'meter'
              ? 'medidor'
              : mode === 'property'
                ? 'propiedad'
                : 'período'}{' '}
            para consultar sus lecturas. La API no ofrece una lista global.
          </Typography>
        ) : query.isError ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <ProblemAlert error={query.error} />
            <Button
              onClick={() => void query.refetch()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Reintentar
            </Button>
          </Stack>
        ) : query.isPending ? (
          <Box role="status" aria-label="Cargando lecturas" sx={{ mt: 2 }}>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} height={54} />
            ))}
          </Box>
        ) : !sorted?.length ? (
          <Typography role="status" color="text.secondary" sx={{ py: 5 }}>
            No hay lecturas para este contexto.
          </Typography>
        ) : (
          <TableContainer>
            <Table aria-label="Lecturas del contexto" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha medida</TableCell>
                  <TableCell>Lectura acumulada</TableCell>
                  <TableCell>Origen</TableCell>
                  <TableCell>Revisión</TableCell>
                  <TableCell>Estado del cálculo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((reading) => (
                  <ReadingRow key={reading.id} reading={reading} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      {creating && (
        <CreateReadingDialog
          key={`${meterId}:${periodId}`}
          open={creating}
          onClose={() => setCreating(false)}
          initialMeterId={mode === 'meter' ? meterId : ''}
          initialPeriodId={periodId}
          onCreated={setCreated}
        />
      )}
    </>
  )
}
