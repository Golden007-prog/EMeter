import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
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
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { ApiError } from '../../shared/api/client'
import { ReadingEvidence } from '../documents/ReadingEvidence'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import {
  dateTimeInputValue,
  localDateTimeCandidates,
} from '../../shared/lib/dateTime'
import {
  losslessDecimal,
  parseMeterReadingInput,
} from '../../shared/lib/decimal'
import {
  decimalToMinorUnits,
  formatMinorUnits,
  getReading,
  getReadingHistory,
  reviewReading,
  updateReading,
  voidReading,
} from './api'
import type { ReadingRevision } from './api'
import { getBillingPeriod, getMeter, getProperty } from '../catalogs/api'
import { BillingPeriodSelect } from './ReadingSelectors'

function snapshot(value: string | null) {
  if (!value) return 'Sin estado anterior registrado.'
  return value
}

export function ReadingDetailPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const [baseVersion, setBaseVersion] = useState(0)
  const [conflict, setConflict] = useState(false)
  const [dialog, setDialog] = useState<'edit' | 'review' | 'void' | null>(null)
  const [decision, setDecision] = useState<'Confirmed' | 'Rejected'>(
    'Confirmed',
  )
  const [value, setValue] = useState('')
  const [measuredAt, setMeasuredAt] = useState('')
  const [offset, setOffset] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<unknown>(null)
  const reading = useQuery({
    queryKey: ['readings', 'detail', id],
    queryFn: ({ signal }) => getReading(id, signal),
    enabled: !!id,
  })
  const meter = useQuery({
    queryKey: ['meters', 'detail', reading.data?.meterId],
    queryFn: ({ signal }) => getMeter(reading.data?.meterId ?? '', signal),
    enabled: !!reading.data,
  })
  const property = useQuery({
    queryKey: ['properties', 'detail', reading.data?.propertyId],
    queryFn: ({ signal }) =>
      getProperty(reading.data?.propertyId ?? '', signal),
    enabled: !!reading.data?.propertyId,
  })
  const period = useQuery({
    queryKey: ['billing-periods', 'detail', reading.data?.billingPeriodId],
    queryFn: ({ signal }) =>
      getBillingPeriod(reading.data?.billingPeriodId ?? '', signal),
    enabled: !!reading.data?.billingPeriodId,
  })
  const destinationPeriod = useQuery({
    queryKey: ['billing-periods', 'detail', periodId],
    queryFn: ({ signal }) => getBillingPeriod(periodId, signal),
    enabled: dialog === 'edit' && !!periodId,
  })
  const previous = useQuery({
    queryKey: ['readings', 'detail', reading.data?.previousReadingId],
    queryFn: ({ signal }) =>
      getReading(reading.data?.previousReadingId ?? '', signal),
    enabled: !!reading.data?.previousReadingId,
  })
  const historyPage = Math.max(1, Number(params.get('historyPage') ?? 1) || 1)
  const history = useQuery({
    queryKey: ['readings', 'history', id, historyPage],
    queryFn: ({ signal }) => getReadingHistory(id, historyPage, 20, signal),
    enabled: !!reading.data,
  })
  const closed =
    period.data?.status === 'Closed' ||
    (!!reading.data?.billingPeriodId && !period.data)
  const invalidate = async () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['readings'] }),
      client.invalidateQueries({ queryKey: ['reports'] }),
      client.invalidateQueries({ queryKey: ['billing-periods'] }),
    ])
  const afterMutation = async () => {
    await invalidate()
    setDialog(null)
    setError(null)
    setReason('')
  }
  const editMutation = useMutation({
    mutationFn: () => {
      const candidates = localDateTimeCandidates(measuredAt)
      const selected =
        candidates.find((item) => String(item.offsetMinutes) === offset) ??
        (candidates.length === 1 ? candidates[0] : undefined)
      const decimal = parseMeterReadingInput(value)
      if (!selected)
        throw new Error(
          'Selecciona una fecha válida y elige el offset si la hora es ambigua.',
        )
      if (!decimal || !reason.trim())
        throw new Error('El valor y el motivo son obligatorios.')
      return updateReading(id, {
        value: decimal,
        measuredAt: selected.iso,
        billingPeriodId: periodId || null,
        expectedVersion: baseVersion,
        reason: reason.trim(),
      })
    },
    onSuccess: afterMutation,
    onError: async (cause) => {
      setError(cause)
      setConflict(cause instanceof ApiError && cause.status === 409)
      await invalidate()
    },
    retry: false,
  })
  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewReading(id, {
        decision,
        expectedVersion: baseVersion,
        reason: reason.trim(),
      }),
    onSuccess: afterMutation,
    onError: async (cause) => {
      setError(cause)
      setConflict(cause instanceof ApiError && cause.status === 409)
      await invalidate()
    },
    retry: false,
  })
  const voidMutation = useMutation({
    mutationFn: () =>
      voidReading(id, { expectedVersion: baseVersion, reason: reason.trim() }),
    onSuccess: afterMutation,
    onError: async (cause) => {
      setError(cause)
      setConflict(cause instanceof ApiError && cause.status === 409)
      await invalidate()
    },
    retry: false,
  })
  const openEdit = () => {
    if (!reading.data) return
    setBaseVersion(reading.data.version)
    setConflict(false)
    setValue(reading.data.value.toString())
    const local = dateTimeInputValue(reading.data.measuredAt, true)
    setMeasuredAt(local)
    setPeriodId(reading.data.billingPeriodId ?? '')
    setOffset(
      String(
        localDateTimeCandidates(local).find(
          (item) =>
            item.instant === new Date(reading.data?.measuredAt ?? '').getTime(),
        )?.offsetMinutes ?? '',
      ),
    )
    setReason('')
    setError(null)
    setDialog('edit')
  }
  const openReview = (next: 'Confirmed' | 'Rejected') => {
    setBaseVersion(reading.data?.version ?? 0)
    setConflict(false)
    setDecision(next)
    setReason('')
    setError(null)
    setDialog('review')
  }
  const openVoid = () => {
    setBaseVersion(reading.data?.version ?? 0)
    setConflict(false)
    setReason('')
    setError(null)
    setDialog('void')
  }
  const candidates = measuredAt
    ? (() => {
        try {
          return localDateTimeCandidates(measuredAt)
        } catch {
          return []
        }
      })()
    : []
  const selectedOffset =
    candidates.length === 1 ||
    candidates.some((item) => String(item.offsetMinutes) === offset)
  const canReview = reading.data?.reviewStatus !== 'Voided'
  const busy =
    editMutation.isPending || reviewMutation.isPending || voidMutation.isPending
  const conflictNotice = conflict && (
    <Alert severity="warning">
      El servidor rechazó la operación. El borrador se conserva. Estado actual:
      v{reading.data?.version}, {reading.data?.reviewStatus}, valor{' '}
      {reading.data?.value.toString()}, fecha {reading.data?.measuredAt}. Revisa
      estos datos antes de continuar.
      <Button
        disabled={
          reading.isFetching ||
          closed ||
          reading.data?.reviewStatus === 'Voided'
        }
        onClick={() => {
          setBaseVersion(reading.data?.version ?? 0)
          setConflict(false)
          setError(null)
        }}
      >
        He revisado el estado actual
      </Button>
    </Alert>
  )
  return (
    <>
      <PageHeading
        eyebrow="LECTURAS / DETALLE Y AUDITORÍA"
        title={
          reading.data ? `Lectura · ${reading.data.unit}` : 'Detalle de lectura'
        }
        description="Revisa valor acumulado, cálculo, estado de revisión y cambios auditados."
        action={
          <Button
            component={Link}
            to={
              reading.data?.meterId
                ? `/lecturas?by=meter&meterId=${reading.data.meterId}`
                : '/lecturas'
            }
            startIcon={<ArrowBackRounded />}
          >
            Volver a lecturas
          </Button>
        }
      />
      {reading.isError ? (
        <ProblemAlert error={reading.error} />
      ) : reading.isPending ? (
        <Skeleton height={260} />
      ) : (
        <Stack spacing={2}>
          {closed && (
            <Alert severity="warning">
              El período asociado está cerrado. Las operaciones que lo
              modificarían están bloqueadas.
            </Alert>
          )}
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h6" component="h2">
                  Medición
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Lectura acumulada:{' '}
                  <strong>
                    {reading.data.value.toString()} {reading.data.unit}
                  </strong>
                </Typography>
                <Typography>
                  Fecha:{' '}
                  {new Date(reading.data.measuredAt).toLocaleString('es-CL', {
                    timeZone: 'America/Santiago',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Typography>
                <Typography>
                  Origen:{' '}
                  {reading.data.source === 'Manual'
                    ? 'Captura manual'
                    : reading.data.source === 'Resident'
                      ? 'Informada por residente'
                      : reading.data.source === 'Company'
                        ? 'Informada por empresa'
                        : 'Propuesta de extracción OCR'}
                </Typography>
                <Typography>
                  Medidor:{' '}
                  {meter.data
                    ? `${meter.data.serialNumber} · ${property.data?.name ?? 'Propiedad'}`
                    : meter.isError
                      ? 'Medidor no disponible'
                      : 'Cargando medidor…'}
                </Typography>
                <Typography>
                  Período:{' '}
                  {period.data
                    ? `${new Date(period.data.start).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} a ${new Date(period.data.end).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}`
                    : reading.data.billingPeriodId
                      ? period.isError
                        ? 'Período no disponible'
                        : 'Cargando período…'
                      : 'Sin período'}
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Revisión:{' '}
                  <Chip size="small" label={reading.data.reviewStatus} />
                </Typography>
                <Typography>
                  Estado del cálculo:{' '}
                  <Chip
                    size="small"
                    color={
                      reading.data.status === 'Warning' ? 'warning' : 'default'
                    }
                    label={reading.data.status}
                  />{' '}
                  · versión {reading.data.version}
                </Typography>
              </Box>
              <Stack
                spacing={1}
                sx={{ alignSelf: { md: 'flex-start' }, minWidth: 200 }}
              >
                <Button
                  variant="outlined"
                  disabled={closed || reading.data.reviewStatus === 'Voided'}
                  onClick={openEdit}
                >
                  Corregir lectura
                </Button>
                {canReview && (
                  <>
                    <Button
                      variant="contained"
                      disabled={closed}
                      onClick={() => openReview('Confirmed')}
                    >
                      {reading.data.reviewStatus === 'Rejected'
                        ? 'Reincorporar lectura'
                        : 'Confirmar lectura'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      disabled={closed}
                      onClick={() => openReview('Rejected')}
                    >
                      Rechazar lectura
                    </Button>
                  </>
                )}
                {reading.data.reviewStatus !== 'Voided' && (
                  <Button color="error" disabled={closed} onClick={openVoid}>
                    Anular lectura
                  </Button>
                )}
              </Stack>
            </Stack>
            {previous.data && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Lectura anterior activa del mismo medidor y origen:{' '}
                {previous.data.value.toString()} {previous.data.unit}. Consumo
                calculado:{' '}
                {decimalToMinorUnits(reading.data.value) <
                decimalToMinorUnits(previous.data.value)
                  ? 'lectura decreciente, consumo no calculable'
                  : `${formatMinorUnits(decimalToMinorUnits(reading.data.value) - decimalToMinorUnits(previous.data.value))} ${reading.data.unit}`}
              </Alert>
            )}
            {reading.data.alerts.length > 0 && (
              <Stack
                spacing={1}
                sx={{ mt: 2 }}
                aria-label="Advertencias de cálculo"
              >
                {reading.data.alerts.map((alert, index) => (
                  <Alert key={`${alert.type}-${index}`} severity="warning">
                    {alert.message}
                  </Alert>
                ))}
              </Stack>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Evidencias asociadas: {reading.data.evidenceIds.length}. Estado de
              revisión y advertencias de cálculo son información independiente.
            </Typography>
          </Paper>
          <ReadingEvidence readingId={id} disabled={closed} />
          <Paper variant="outlined" sx={{ p: 3, overflowX: 'auto' }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Historial de cambios
            </Typography>
            {history.isError ? (
              <Stack spacing={1}>
                <ProblemAlert error={history.error} />
                <Button
                  onClick={() => void history.refetch()}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Reintentar
                </Button>
              </Stack>
            ) : history.isPending ? (
              <Skeleton height={90} />
            ) : history.data.items.length === 0 ? (
              <Typography color="text.secondary">
                Aún no hay cambios auditados.
              </Typography>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Acción</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell>Antes / después</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.data.items.map((item: ReadingRevision) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.changedAt).toLocaleString('es-CL', {
                          timeZone: 'America/Santiago',
                        })}
                      </TableCell>
                      <TableCell>{item.action}</TableCell>
                      <TableCell>{item.reason || 'Sin motivo'}</TableCell>
                      <TableCell>
                        <details>
                          <summary>Ver snapshots</summary>
                          <Typography
                            component="pre"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              fontSize: 12,
                              maxWidth: 520,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            Antes:
                            {snapshot(item.beforeJson)}
                            Después:
                            {snapshot(item.afterJson)}
                          </Typography>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {history.data && (
              <Stack
                direction="row"
                sx={{ mt: 2, justifyContent: 'space-between' }}
              >
                <Button
                  disabled={historyPage <= 1}
                  component={Link}
                  to={`/lecturas/${id}?historyPage=${historyPage - 1}`}
                >
                  Cambios anteriores
                </Button>
                <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                  Página {history.data.pageNumber} · {history.data.totalCount}{' '}
                  cambios
                </Typography>
                <Button
                  disabled={!history.data.hasNextPage}
                  component={Link}
                  to={`/lecturas/${id}?historyPage=${historyPage + 1}`}
                >
                  Cambios posteriores
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      )}
      <Dialog
        open={dialog === 'edit'}
        onClose={() => {
          if (!busy) setDialog(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Corregir lectura</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            {conflictNotice}
            <Alert severity="info">
              La corrección vuelve la lectura a pendiente y puede recalcular
              registros posteriores.
            </Alert>
            <TextField
              disabled={busy}
              label="Lectura acumulada"
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              helperText="Hasta dos decimales, menor que 10^16."
            />
            <TextField
              disabled={busy}
              label="Fecha y hora medida"
              type="datetime-local"
              required
              value={measuredAt}
              onChange={(event) => {
                setMeasuredAt(event.target.value)
                setOffset('')
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { step: 1 },
              }}
              error={!!measuredAt && candidates.length === 0}
              helperText={
                candidates.length === 0
                  ? 'Hora local inexistente. Elige otra.'
                  : 'Zona America/Santiago.'
              }
            />
            {candidates.length > 1 && (
              <TextField
                disabled={busy}
                select
                label="Offset para hora ambigua"
                value={offset}
                onChange={(event) => setOffset(event.target.value)}
              >
                <MenuItem value="">Selecciona la ocurrencia</MenuItem>
                {candidates.map((candidate) => (
                  <MenuItem
                    key={candidate.iso}
                    value={String(candidate.offsetMinutes)}
                  >
                    {candidate.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {destinationPeriod.error && (
              <ProblemAlert error={destinationPeriod.error} />
            )}
            {destinationPeriod.data?.status === 'Closed' && (
              <Alert severity="warning">
                El período de destino está cerrado.
              </Alert>
            )}
            <BillingPeriodSelect
              value={periodId}
              optional
              onChange={(item) => setPeriodId(item?.id ?? '')}
            />
            <TextField
              disabled={busy}
              label="Motivo de la corrección"
              required
              multiline
              minRows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={
              busy ||
              conflict ||
              closed ||
              (!!periodId &&
                (!destinationPeriod.data ||
                  destinationPeriod.data.status === 'Closed')) ||
              !parseMeterReadingInputSafe(value) ||
              !reason.trim() ||
              !measuredAt ||
              !selectedOffset
            }
            onClick={() => editMutation.mutate()}
          >
            Guardar corrección · v{baseVersion}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dialog === 'review'}
        onClose={() => {
          if (!busy) setDialog(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {decision === 'Confirmed'
            ? reading.data?.reviewStatus === 'Rejected'
              ? 'Reincorporar lectura'
              : 'Confirmar lectura'
            : 'Rechazar lectura'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            {conflictNotice}
            <Typography>
              La decisión se aplica a la versión {reading.data?.version}. Las
              advertencias permanecen visibles aunque confirmes.
            </Typography>
            <TextField
              disabled={busy}
              label="Motivo"
              required
              multiline
              minRows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={busy || conflict || closed || !reason.trim()}
            color={decision === 'Rejected' ? 'warning' : 'primary'}
            onClick={() => reviewMutation.mutate()}
          >
            {decision === 'Confirmed'
              ? 'Confirmar decisión'
              : 'Rechazar lectura'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dialog === 'void'}
        onClose={() => {
          if (!busy) setDialog(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Anular lectura</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            {conflictNotice}
            <Alert severity="warning">
              La anulación es definitiva. El registro, historial y evidencias se
              conservan.
            </Alert>
            <TextField
              disabled={busy}
              label="Motivo de anulación"
              required
              multiline
              minRows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={busy || conflict || closed || !reason.trim()}
            onClick={() => voidMutation.mutate()}
          >
            Anular lectura · v{baseVersion}
          </Button>
        </DialogActions>
      </Dialog>
      {error && (
        <Box sx={{ mt: 2 }}>
          <Button size="small" onClick={() => void reading.refetch()}>
            Recargar estado actual
          </Button>
        </Box>
      )}
    </>
  )
}

function parseMeterReadingInputSafe(value: string) {
  try {
    return losslessDecimal(value)
  } catch {
    return null
  }
}
