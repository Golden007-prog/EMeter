import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import {
  localDateTimeCandidates,
  dateTimeInputValue,
} from '../../shared/lib/dateTime'
import {
  losslessDecimal,
  parseMeterReadingInput,
} from '../../shared/lib/decimal'
import { getBillingPeriod, getMeter, resourceLabels } from '../catalogs/api'
import type { BillingPeriod } from '../catalogs/api'
import { BillingPeriodSelect, MeterSelect } from './ReadingSelectors'
import {
  createReading,
  decimalToMinorUnits,
  formatMinorUnits,
  listReadingsByMeter,
  readingSources,
} from './api'
import type { Reading, ReadingSource } from './api'
import type { Meter } from '../catalogs/api'

const sourceLabels: Record<ReadingSource, string> = {
  Manual: 'Captura manual',
  Resident: 'Informada por residente',
  Company: 'Informada por empresa',
  OCR: 'Propuesta de extracción OCR',
}

export function CreateReadingDialog({
  open,
  onClose,
  initialMeterId = '',
  initialPeriodId = '',
  onCreated,
}: {
  open: boolean
  onClose: () => void
  initialMeterId?: string
  initialPeriodId?: string
  onCreated: (reading: Reading) => void
}) {
  const client = useQueryClient()
  const requestId = useRef<string | null>(null)
  const [meter, setMeter] = useState<Meter | null | undefined>(undefined)
  const [period, setPeriod] = useState<BillingPeriod | null | undefined>(
    undefined,
  )
  const [source, setSource] = useState<ReadingSource>('Manual')
  const [value, setValue] = useState('')
  const [measuredAt, setMeasuredAt] = useState(
    dateTimeInputValue(new Date().toISOString()),
  )
  const [offset, setOffset] = useState('')
  const [error, setError] = useState<unknown>(null)
  const selectedMeter = useQuery({
    queryKey: ['meters', 'detail', initialMeterId],
    queryFn: ({ signal }) => getMeter(initialMeterId, signal),
    enabled: !!initialMeterId && !meter,
  })
  const meterValue = meter === undefined ? (selectedMeter.data ?? null) : meter
  const selectedPeriod = useQuery({
    queryKey: ['billing-periods', 'detail', initialPeriodId],
    queryFn: ({ signal }) => getBillingPeriod(initialPeriodId, signal),
    enabled: !!initialPeriodId && !period,
  })
  const periodValue =
    period === undefined ? (selectedPeriod.data ?? null) : period
  const readingHistory = useQuery({
    queryKey: ['readings', 'meter', meterValue?.id],
    queryFn: ({ signal }) => listReadingsByMeter(meterValue?.id ?? '', signal),
    enabled: !!meterValue,
  })
  const candidates = measuredAt
    ? (() => {
        try {
          return localDateTimeCandidates(measuredAt)
        } catch {
          return []
        }
      })()
    : []
  const instant =
    candidates.length === 1
      ? candidates[0].instant
      : candidates.find((item) => String(item.offsetMinutes) === offset)
          ?.instant
  const normalizedValue = (() => {
    try {
      return parseMeterReadingInput(value)
    } catch {
      return null
    }
  })()
  const previous = readingHistory.data
    ?.filter(
      (reading) =>
        reading.source === source &&
        reading.reviewStatus !== 'Rejected' &&
        reading.reviewStatus !== 'Voided' &&
        (!instant || new Date(reading.measuredAt).getTime() < instant),
    )
    .sort(
      (a, b) =>
        new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    )[0]
  let estimate: string | null = null
  if (previous && normalizedValue) {
    try {
      const consumption =
        decimalToMinorUnits(losslessDecimal(normalizedValue)) -
        decimalToMinorUnits(previous.value)
      estimate =
        consumption < 0n
          ? 'La lectura es menor que la anterior; el backend conservará la advertencia.'
          : `${formatMinorUnits(consumption)} ${meterValue?.unit ?? ''}`
    } catch {
      estimate = null
    }
  }
  const mutation = useMutation({
    mutationFn: async () => {
      if (!meterValue) throw new Error('Selecciona un medidor.')
      if (periodValue?.status === 'Closed')
        throw new Error('El período está cerrado.')
      if (!instant || candidates.length === 0)
        throw new Error('Selecciona una fecha válida de Santiago.')
      if (candidates.length > 1 && !offset)
        throw new Error('Elige explícitamente el offset de la hora ambigua.')
      if (!normalizedValue)
        throw new Error('Usa un valor no negativo con hasta dos decimales.')
      requestId.current ??= crypto.randomUUID()
      return createReading({
        meterId: meterValue.id,
        propertyId: meterValue.propertyId,
        billingPeriodId: periodValue?.id ?? null,
        value: normalizedValue,
        unit: meterValue.unit,
        measuredAt: candidates.find((item) => item.instant === instant)!.iso,
        source,
        requestId: requestId.current,
      })
    },
    onSuccess: async (reading) => {
      requestId.current = null
      await Promise.all([
        client.invalidateQueries({ queryKey: ['readings'] }),
        client.invalidateQueries({ queryKey: ['reports'] }),
      ])
      onCreated(reading)
      onClose()
    },
    onError: async (cause) => {
      setError(cause)
      await client.invalidateQueries({ queryKey: ['readings'] })
    },
    retry: false,
  })
  const closed = periodValue?.status === 'Closed'
  const unresolved =
    (meter === undefined && !!initialMeterId && !selectedMeter.data) ||
    (period === undefined && !!initialPeriodId && !selectedPeriod.data)
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Nueva lectura acumulada</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {Boolean(error) && <ProblemAlert error={error} />}
          {selectedPeriod.isError && (
            <ProblemAlert error={selectedPeriod.error} />
          )}
          {selectedMeter.isError && (
            <ProblemAlert error={selectedMeter.error} />
          )}
          <MeterSelect
            value={meterValue?.id ?? ''}
            disabled={mutation.isPending}
            onChange={(item) => {
              setMeter(item)
              setValue('')
              requestId.current = null
            }}
          />
          <BillingPeriodSelect
            value={periodValue?.id ?? ''}
            optional
            disabled={mutation.isPending}
            onChange={(item) => {
              setPeriod(item)
              requestId.current = null
            }}
          />
          {closed && (
            <Alert severity="warning">
              El período seleccionado está cerrado. No se pueden agregar
              lecturas.
            </Alert>
          )}
          <TextField
            select
            label="Origen de la lectura"
            value={source}
            disabled={mutation.isPending}
            onChange={(event) => {
              setSource(event.target.value as ReadingSource)
              requestId.current = null
            }}
            helperText="El origen separa lecturas Resident/Company en conciliación; Manual y OCR también se reportan."
          >
            {readingSources.map((item) => (
              <MenuItem key={item} value={item}>
                {sourceLabels[item]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Lectura acumulada"
            required
            value={value}
            disabled={mutation.isPending}
            onChange={(event) => {
              setValue(event.target.value)
              requestId.current = null
            }}
            inputMode="decimal"
            error={!!value && !normalizedValue}
            helperText={
              normalizedValue
                ? `Unidad: ${meterValue?.unit ?? 'selecciona un medidor'}. No es consumo ni monto.`
                : 'Valor no negativo, menor que 10^16 y con hasta dos decimales.'
            }
          />
          {estimate && (
            <Typography
              variant="body2"
              color={
                estimate.startsWith('La lectura')
                  ? 'warning.main'
                  : 'text.secondary'
              }
            >
              Consumo estimado frente a la anterior del mismo origen: {estimate}
            </Typography>
          )}
          <TextField
            label="Fecha y hora de medición"
            type="datetime-local"
            required
            value={measuredAt}
            disabled={mutation.isPending}
            onChange={(event) => {
              setMeasuredAt(event.target.value)
              setOffset('')
              requestId.current = null
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!!measuredAt && candidates.length === 0}
            helperText={
              candidates.length === 0
                ? 'Esa hora no existe en America/Santiago. Elige otra.'
                : 'Se enviará con el offset real de America/Santiago.'
            }
          />
          {candidates.length > 1 && (
            <TextField
              select
              label="Offset de la hora repetida"
              value={offset}
              onChange={(event) => {
                setOffset(event.target.value)
                requestId.current = null
              }}
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
          <Typography variant="body2" color="text.secondary">
            Medidor:{' '}
            {meterValue
              ? `${meterValue.serialNumber} · ${resourceLabels[meterValue.resourceType]} · ${meterValue.unit}`
              : 'No seleccionado'}
            . La lectura anterior y el consumo definitivo los resuelve el
            backend.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={
            mutation.isPending ||
            unresolved ||
            !meterValue ||
            closed ||
            !normalizedValue ||
            !instant ||
            (candidates.length > 1 && !offset)
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? 'Guardando…'
            : error
              ? 'Reintentar la misma captura'
              : 'Guardar lectura'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
