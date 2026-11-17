import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import {
  localDateTimeCandidates,
  dateTimeInputValue,
} from '../../shared/lib/dateTime'
import {
  createBillingPeriod,
  listBillingPeriods,
  periodStatuses,
  setBillingPeriodStatus,
  updateBillingPeriod,
} from './api'
import type { BillingPeriod, BillingPeriodStatus } from './api'

const statusLabels: Record<BillingPeriodStatus, string> = {
  Open: 'Abierto',
  Collecting: 'En recopilación',
  Validating: 'En validación',
  Closed: 'Cerrado',
}
const editableStatuses: BillingPeriodStatus[] = [
  'Open',
  'Collecting',
  'Validating',
]
function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function BillingPeriodsPage() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BillingPeriod | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [startOffset, setStartOffset] = useState('')
  const [endOffset, setEndOffset] = useState('')
  const [error, setError] = useState<unknown>(null)
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const statusParam = params.get('status') ?? ''
  const status = periodStatuses.includes(statusParam as BillingPeriodStatus)
    ? (statusParam as BillingPeriodStatus)
    : undefined
  const query = useQuery({
    queryKey: ['billing-periods', 'list', { page, status }],
    queryFn: ({ signal }) =>
      listBillingPeriods({ page, pageSize: 25, status }, signal),
  })
  const close = () => {
    setCreating(false)
    setEditing(null)
    setError(null)
    setStartOffset('')
    setEndOffset('')
  }
  const mutation = useMutation({
    mutationFn: () => {
      const starts = localDateTimeCandidates(start)
      const ends = localDateTimeCandidates(end)
      const selectedStart =
        starts.find(
          (candidate) => String(candidate.offsetMinutes) === startOffset,
        ) ?? (starts.length === 1 ? starts[0] : undefined)
      const selectedEnd =
        ends.find(
          (candidate) => String(candidate.offsetMinutes) === endOffset,
        ) ?? (ends.length === 1 ? ends[0] : undefined)
      if (!selectedStart || !selectedEnd)
        throw new Error(
          'Elige explícitamente el offset para las horas ambiguas.',
        )
      if (selectedEnd.instant <= selectedStart.instant)
        throw new Error('El fin debe ser posterior al inicio.')
      const body = { start: selectedStart.iso, end: selectedEnd.iso }
      return editing
        ? updateBillingPeriod(editing.id, body)
        : createBillingPeriod(body)
    },
    onSuccess: async (period) => {
      await client.invalidateQueries()
      if (creating && period)
        setParams((old) => {
          const next = new URLSearchParams(old)
          next.set('billingPeriodId', period.id)
          return next
        })
      close()
    },
    onError: setError,
    retry: false,
  })
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string
      nextStatus: BillingPeriodStatus
    }) => setBillingPeriodStatus(id, nextStatus),
    onSuccess: async () => {
      await client.invalidateQueries()
    },
    retry: false,
  })
  const openNew = () => {
    setStart('')
    setEnd('')
    setStartOffset('')
    setEndOffset('')
    setError(null)
    setCreating(true)
  }
  const openEdit = (period: BillingPeriod) => {
    const localStart = dateTimeInputValue(period.start, true)
    const localEnd = dateTimeInputValue(period.end, true)
    setStart(localStart)
    setEnd(localEnd)
    setStartOffset(
      String(
        localDateTimeCandidates(localStart).find(
          (item) => item.instant === new Date(period.start).getTime(),
        )?.offsetMinutes ?? '',
      ),
    )
    setEndOffset(
      String(
        localDateTimeCandidates(localEnd).find(
          (item) => item.instant === new Date(period.end).getTime(),
        )?.offsetMinutes ?? '',
      ),
    )
    setError(null)
    setEditing(period)
  }
  const updateStatusFilter = (value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      if (value) next.set('status', value)
      else next.delete('status')
      next.delete('page')
      return next
    })
  const starts = start
    ? (() => {
        try {
          return localDateTimeCandidates(start)
        } catch {
          return []
        }
      })()
    : []
  const ends = end
    ? (() => {
        try {
          return localDateTimeCandidates(end)
        } catch {
          return []
        }
      })()
    : []
  const validDates =
    starts.length > 0 &&
    ends.length > 0 &&
    (starts.length === 1 || !!startOffset) &&
    (ends.length === 1 || !!endOffset)
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / CATÁLOGOS"
        title="Períodos"
        description="Define los intervalos de medición y su estado operativo."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={openNew}
          >
            Nuevo período
          </Button>
        }
      />
      <CatalogNavigation />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          select
          label="Estado"
          size="small"
          value={status ?? ''}
          onChange={(event) => updateStatusFilter(event.target.value)}
          sx={{ mb: 2, minWidth: 220 }}
        >
          <MenuItem value="">Todos los estados</MenuItem>
          {periodStatuses.map((value) => (
            <MenuItem key={value} value={value}>
              {statusLabels[value]}
            </MenuItem>
          ))}
        </TextField>
        {query.isError ? (
          <Stack spacing={2}>
            <ProblemAlert error={query.error} />
            <Button onClick={() => void query.refetch()}>Reintentar</Button>
          </Stack>
        ) : query.isPending ? (
          <Box role="status" aria-label="Cargando períodos">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} height={54} />
            ))}
          </Box>
        ) : query.data.items.length === 0 ? (
          <Typography role="status" color="text.secondary" sx={{ py: 4 }}>
            {status
              ? 'No hay períodos con ese estado.'
              : 'Aún no hay períodos registrados.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table aria-label="Períodos de medición">
              <TableHead>
                <TableRow>
                  <TableCell>Intervalo (hora de Santiago)</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((period) => (
                  <PeriodRow
                    key={period.id}
                    period={period}
                    onEdit={openEdit}
                    onChangeStatus={(nextStatus) =>
                      statusMutation.mutate({ id: period.id, nextStatus })
                    }
                    statusPending={statusMutation.isPending}
                  />
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
              {query.data.totalCount} períodos · página {query.data.pageNumber}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                disabled={page <= 1 || query.isFetching}
                onClick={() =>
                  setParams((old) => {
                    const next = new URLSearchParams(old)
                    next.set('page', String(page - 1))
                    return next
                  })
                }
              >
                Anterior
              </Button>
              <Button
                disabled={!query.data.hasNextPage || query.isFetching}
                onClick={() =>
                  setParams((old) => {
                    const next = new URLSearchParams(old)
                    next.set('page', String(page + 1))
                    return next
                  })
                }
              >
                Siguiente
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
      {statusMutation.isError && <ProblemAlert error={statusMutation.error} />}
      <Dialog
        open={creating || !!editing}
        onClose={close}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing ? 'Editar fechas del período' : 'Nuevo período de medición'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            <Typography variant="body2" color="text.secondary">
              Las fechas se interpretan en America/Santiago y se guardan con su
              offset correspondiente.
            </Typography>
            <TextField
              label="Inicio"
              type="datetime-local"
              required
              value={start}
              onChange={(event) => {
                setStart(event.target.value)
                setStartOffset('')
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { step: 1 },
              }}
              error={!!start && starts.length === 0}
              helperText={
                start && starts.length === 0
                  ? 'Esa hora local no existe por el cambio de horario. Elige otra hora.'
                  : 'Fecha y hora local de inicio.'
              }
            />
            {starts.length > 1 && (
              <TextField
                select
                label="Offset para el inicio"
                value={startOffset}
                onChange={(event) => setStartOffset(event.target.value)}
              >
                <MenuItem value="">Elige una ocurrencia</MenuItem>
                {starts.map((candidate) => (
                  <MenuItem
                    key={candidate.iso}
                    value={String(candidate.offsetMinutes)}
                  >
                    {candidate.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Fin"
              type="datetime-local"
              required
              value={end}
              onChange={(event) => {
                setEnd(event.target.value)
                setEndOffset('')
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { step: 1 },
              }}
              error={!!end && ends.length === 0}
              helperText={
                end && ends.length === 0
                  ? 'Esa hora local no existe por el cambio de horario. Elige otra hora.'
                  : 'Fecha y hora local de término.'
              }
            />
            {ends.length > 1 && (
              <TextField
                select
                label="Offset para el fin"
                value={endOffset}
                onChange={(event) => setEndOffset(event.target.value)}
              >
                <MenuItem value="">Elige una ocurrencia</MenuItem>
                {ends.map((candidate) => (
                  <MenuItem
                    key={candidate.iso}
                    value={String(candidate.offsetMinutes)}
                  >
                    {candidate.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {editing?.status === 'Closed' && (
              <Alert severity="warning">
                Los períodos cerrados son inmutables.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={mutation.isPending || !validDates}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Guardando…'
              : editing
                ? 'Guardar fechas'
                : 'Crear período'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function PeriodRow({
  period,
  onEdit,
  onChangeStatus,
  statusPending,
}: {
  period: BillingPeriod
  onEdit: (period: BillingPeriod) => void
  onChangeStatus: (status: BillingPeriodStatus) => void
  statusPending: boolean
}) {
  const [chosenStatus, setNextStatus] = useState<BillingPeriodStatus>(
    period.status === 'Open' ? 'Collecting' : 'Open',
  )
  const nextStatus =
    chosenStatus === period.status
      ? period.status === 'Open'
        ? 'Collecting'
        : 'Open'
      : chosenStatus
  return (
    <TableRow hover>
      <TableCell>
        <Typography>{formatDate(period.start)}</Typography>
        <Typography variant="body2" color="text.secondary">
          hasta {formatDate(period.end)}
        </Typography>
      </TableCell>
      <TableCell>{statusLabels[period.status]}</TableCell>
      <TableCell align="right">
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
        >
          <Button component={Link} to={`/periodo?billingPeriodId=${period.id}`}>
            Abrir período
          </Button>
          <Button
            disabled={period.status === 'Closed'}
            onClick={() => onEdit(period)}
          >
            Editar fechas
          </Button>
          {period.status !== 'Closed' && (
            <>
              <TextField
                select
                size="small"
                label="Cambiar estado"
                value={nextStatus}
                onChange={(event) =>
                  setNextStatus(event.target.value as BillingPeriodStatus)
                }
                sx={{ minWidth: 170 }}
              >
                {editableStatuses
                  .filter((status) => status !== period.status)
                  .map((status) => (
                    <MenuItem key={status} value={status}>
                      {statusLabels[status]}
                    </MenuItem>
                  ))}
              </TextField>
              <Button
                disabled={statusPending}
                onClick={() => onChangeStatus(nextStatus)}
              >
                Aplicar
              </Button>
            </>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  )
}
