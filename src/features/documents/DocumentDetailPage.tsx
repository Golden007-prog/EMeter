import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { QuerySection } from '../../shared/ui/QuerySection'
import { localDateTimeCandidates } from '../../shared/lib/dateTime'
import { parseMeterReadingInput } from '../../shared/lib/decimal'
import { getBillingPeriod, getMeter } from '../catalogs/api'
import { MeterSelect, BillingPeriodSelect } from '../readings/ReadingSelectors'
import { getExtraction, confirmExtraction, retryExtraction } from './api'
import { ExtractionResultPanel } from './ExtractionResultPanel'
import { OriginalFile } from './OriginalFile'

export function DocumentDetailPage() {
  const { id = '' } = useParams()
  return <DocumentDetail key={id} id={id} />
}
function DocumentDetail({ id }: { id: string }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [meterId, setMeterId] = useState('')
  const [periodId, setPeriodId] = useState(params.get('billingPeriodId') ?? '')
  const [value, setValue] = useState('')
  const [date, setDate] = useState('')
  const [offset, setOffset] = useState('')
  const [source, setSource] = useState<'Company' | 'Resident' | 'OCR'>(
    'Company',
  )
  const extraction = useQuery({
    queryKey: ['extractions', 'detail', id],
    queryFn: ({ signal }) => getExtraction(id, signal),
    refetchInterval: (query) =>
      ['Queued', 'Processing'].includes(query.state.data?.status ?? '')
        ? 2000
        : false,
  })
  const meter = useQuery({
    queryKey: ['meters', 'detail', meterId],
    queryFn: ({ signal }) => getMeter(meterId, signal),
    enabled: !!meterId,
  })
  const period = useQuery({
    queryKey: ['billing-periods', 'detail', periodId],
    queryFn: ({ signal }) => getBillingPeriod(periodId, signal),
    enabled: !!periodId,
  })
  const candidates = (() => {
    try {
      return localDateTimeCandidates(date)
    } catch {
      return []
    }
  })()
  const selected =
    candidates.length === 1
      ? candidates[0]
      : candidates.find((item) => String(item.offsetMinutes) === offset)
  const validValue = (() => {
    try {
      return parseMeterReadingInput(value)
    } catch {
      return null
    }
  })()
  const confirm = useMutation({
    mutationFn: () => {
      if (
        !meter.data ||
        !selected ||
        !validValue ||
        (periodId && !period.data) ||
        period.data?.status === 'Closed'
      )
        throw new Error(
          'Completa los datos revisados y selecciona un período abierto o sin período.',
        )
      return confirmExtraction(id, {
        meterId,
        propertyId: meter.data.propertyId,
        unit: meter.data.unit,
        value: validValue,
        measuredAt: selected.iso,
        billingPeriodId: periodId || null,
        source,
      })
    },
    onSuccess: async (result) => {
      await client.invalidateQueries()
      navigate(
        `/lecturas/${result.readingId}${periodId ? `?billingPeriodId=${encodeURIComponent(periodId)}` : ''}`,
      )
    },
    onError: async () => {
      await extraction.refetch()
    },
  })
  const retry = useMutation({
    mutationFn: () => retryExtraction(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['extractions'] })
    },
  })
  const busy = confirm.isPending || retry.isPending
  return (
    <Stack spacing={2}>
      <PageHeading
        eyebrow="DOCUMENTOS / REVISIÓN"
        title="Revisar documento"
        description="Contrasta el original con las propuestas antes de crear la lectura."
        action={
          <Button component={Link} to="/documentos">
            Volver a documentos
          </Button>
        }
      />
      <QuerySection title="Estado de extracción" query={extraction}>
        {(data) => (
          <Stack spacing={1}>
            <Typography>
              Estado: {data.status} · Intentos: {data.attempts}
            </Typography>
            {data.error && <Alert severity="error">{data.error}</Alert>}
            {['Queued', 'Processing'].includes(data.status) && (
              <Alert severity="info">
                El documento está en procesamiento. El estado se actualiza
                automáticamente.
              </Alert>
            )}
            {data.status === 'Failed' && (
              <Button disabled={busy} onClick={() => retry.mutate()}>
                Reintentar extracción
              </Button>
            )}
            {data.confirmedReadingId && (
              <Button
                component={Link}
                to={`/lecturas/${data.confirmedReadingId}`}
              >
                Abrir lectura confirmada
              </Button>
            )}
            <Button
              disabled={extraction.isFetching}
              onClick={() => void extraction.refetch()}
            >
              Actualizar estado
            </Button>
            {retry.error && <ProblemAlert error={retry.error} />}
          </Stack>
        )}
      </QuerySection>
      {extraction.data && (
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          sx={{ '& > *': { flex: 1, minWidth: 0 } }}
        >
          <OriginalFile id={extraction.data.evidenceId} />
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography component="h2" variant="h6">
                  Propuestas OCR
                </Typography>
                {extraction.data.result ? (
                  <ExtractionResultPanel result={extraction.data.result} />
                ) : (
                  <Typography>Aún no hay propuestas disponibles.</Typography>
                )}
              </Stack>
            </Paper>
            {extraction.data.status === 'NeedsReview' && (
              <Paper
                component="form"
                variant="outlined"
                sx={{ p: 2 }}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!busy) confirm.mutate()
                }}
              >
                <Stack spacing={2}>
                  <Typography component="h2" variant="h6">
                    Valores revisados
                  </Typography>
                  <MeterSelect
                    value={meterId}
                    disabled={busy}
                    onChange={(item) => setMeterId(item?.id ?? '')}
                  />
                  <BillingPeriodSelect
                    value={periodId}
                    optional
                    disabled={busy}
                    onChange={(item) => setPeriodId(item?.id ?? '')}
                  />
                  {meter.error && <ProblemAlert error={meter.error} />}
                  {period.error && <ProblemAlert error={period.error} />}
                  {period.data?.status === 'Closed' && (
                    <Alert severity="warning">
                      El período está cerrado. Selecciona otro período o guarda
                      sin período.
                    </Alert>
                  )}
                  <TextField
                    select
                    label="Origen revisado"
                    value={source}
                    disabled={busy}
                    onChange={(event) =>
                      setSource(event.target.value as typeof source)
                    }
                  >
                    {['Company', 'Resident', 'OCR'].map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    required
                    label="Lectura acumulada revisada"
                    value={value}
                    disabled={busy}
                    onChange={(event) => setValue(event.target.value)}
                    helperText={`Unidad del medidor: ${meter.data?.unit ?? 'selecciona medidor'}. Hasta dos decimales.`}
                    inputMode="decimal"
                    error={!!value && !validValue}
                  />
                  <TextField
                    required
                    label="Fecha y hora medida revisada"
                    type="datetime-local"
                    value={date}
                    disabled={busy}
                    onChange={(event) => {
                      setDate(event.target.value)
                      setOffset('')
                    }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    helperText="America/Santiago. Verifica la medición; no uses automáticamente la fecha de vencimiento."
                  />
                  {candidates.length > 1 && (
                    <TextField
                      select
                      label="Ocurrencia de hora repetida"
                      value={offset}
                      onChange={(event) => setOffset(event.target.value)}
                    >
                      {candidates.map((item) => (
                        <MenuItem
                          key={item.iso}
                          value={String(item.offsetMinutes)}
                        >
                          {item.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  {date && candidates.length === 0 && (
                    <Alert severity="warning">
                      La fecha u hora local no es válida.
                    </Alert>
                  )}
                  {confirm.error && <ProblemAlert error={confirm.error} />}
                  <Alert severity="info">
                    Confirmar crea una nueva lectura y la asocia al original.
                    Para respaldar una lectura ya registrada, usa Adjuntar
                    evidencia en su detalle.
                  </Alert>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      busy ||
                      !meter.data ||
                      !selected ||
                      !validValue ||
                      (!!periodId && !period.data) ||
                      period.data?.status === 'Closed'
                    }
                  >
                    {confirm.isPending
                      ? 'Confirmando…'
                      : 'Confirmar valores y crear lectura'}
                  </Button>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
