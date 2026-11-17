import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { QuerySection } from '../../shared/ui/QuerySection'
import { getMeter, getProperty } from '../catalogs/api'
import { formatDecimalInput } from '../../shared/lib/decimal'
import type { ExactDecimal } from '../../shared/lib/decimal'
import {
  getPendingReadings,
  getMissingReadings,
  getAbnormalReadings,
  getMonthlySummary,
} from './api'
import type { MonthlySummary } from './api'

export function MeterName({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['meters', 'detail', id],
    queryFn: ({ signal }) => getMeter(id, signal),
  })
  return (
    <>
      {query.data?.serialNumber ??
        (query.isError ? 'Medidor no disponible' : 'Cargando medidor…')}
    </>
  )
}
export function PropertyName({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['properties', 'detail', id],
    queryFn: ({ signal }) => getProperty(id, signal),
  })
  return (
    <>
      {query.data?.name ??
        (query.isError ? 'Propiedad no disponible' : 'Cargando propiedad…')}
    </>
  )
}
export function Amount({ value }: { value: ExactDecimal | null | undefined }) {
  return <>{value == null ? 'No calculable' : formatDecimalInput(value)}</>
}
export function SummaryContent({ data }: { data: MonthlySummary }) {
  return (
    <Stack spacing={2}>
      <Typography>
        {data.readingCount} lecturas · {data.pendingReadingCount} pendientes ·{' '}
        {data.abnormalReadingCount} con anomalías · {data.mismatchCount}{' '}
        discrepancias
      </Typography>
      <Typography>
        Lecturas sin consumo calculable: {data.uncalculableReadingCount}
      </Typography>
      <Typography>
        Diferencia agregada residente/empresa:{' '}
        <Amount value={data.mismatchPercentage} />
        {data.mismatchPercentage == null ? '' : ' %'}
      </Typography>
      {data.uncalculableReadingCount > 0 && (
        <Alert severity="warning">
          Hay consumos incompletos. Una lectura acumulada sin anterior válida no
          constituye consumo cero.
        </Alert>
      )}
      <TableContainer>
        <Table aria-label="Consumos por origen y unidad">
          <TableHead>
            <TableRow>
              <TableCell>Origen</TableCell>
              <TableCell>Unidad</TableCell>
              <TableCell>Consumo</TableCell>
              <TableCell>Sin cálculo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.totalsBySource?.map((item) => (
              <TableRow key={`${item.source}:${item.unit}`}>
                <TableCell>{item.source}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>
                  <Amount value={item.consumption} />
                </TableCell>
                <TableCell>{item.uncalculableReadingCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TableContainer>
        <Table aria-label="Comparación residente y empresa">
          <TableHead>
            <TableRow>
              <TableCell>Unidad</TableCell>
              <TableCell>Residente</TableCell>
              <TableCell>Empresa</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.totalsByUnit?.map((item) => (
              <TableRow key={item.unit}>
                <TableCell>{item.unit}</TableCell>
                <TableCell>
                  <Amount value={item.resident} />
                </TableCell>
                <TableCell>
                  <Amount value={item.company} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!data.readingCount && (
        <Typography>No hay lecturas en este período.</Typography>
      )}
    </Stack>
  )
}
export function SummaryPanel({ periodId }: { periodId: string }) {
  const query = useQuery({
    queryKey: ['reports', 'summary', periodId],
    queryFn: ({ signal }) => getMonthlySummary(periodId, signal),
  })
  return (
    <QuerySection title="Resumen del período" query={query}>
      {(data) => <SummaryContent data={data} />}
    </QuerySection>
  )
}
export function OperationalReports({
  periodId,
  propertyId,
}: {
  periodId?: string
  propertyId?: string
}) {
  const pending = useQuery({
    queryKey: ['reports', 'pending', periodId, propertyId],
    queryFn: ({ signal }) => getPendingReadings(periodId, propertyId, signal),
  })
  const missing = useQuery({
    queryKey: ['reports', 'missing', periodId, propertyId],
    queryFn: ({ signal }) => getMissingReadings(periodId!, propertyId, signal),
    enabled: !!periodId,
  })
  const abnormal = useQuery({
    queryKey: ['reports', 'abnormal', periodId],
    queryFn: ({ signal }) => getAbnormalReadings(periodId, signal),
  })
  return (
    <Stack spacing={2}>
      <QuerySection title="Pendientes de revisión" query={pending}>
        {(rows) => (
          <Stack spacing={1}>
            {rows.length === 0 && (
              <Typography>No hay lecturas pendientes.</Typography>
            )}
            {rows.map((row) => (
              <Stack
                key={row.readingId}
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography>
                  <MeterName id={row.meterId} /> ·{' '}
                  {new Date(row.measuredAt).toLocaleString('es-CL', {
                    timeZone: 'America/Santiago',
                  })}
                </Typography>
                <Button component={Link} to={`/lecturas/${row.readingId}`}>
                  Revisar lectura
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </QuerySection>
      {periodId && (
        <QuerySection title="Medidores sin lectura activa" query={missing}>
          {(rows) => (
            <Stack spacing={1}>
              <Typography variant="body2">
                El faltante no distingue orígenes. Rechazadas y anuladas no lo
                cubren.
              </Typography>
              {rows.length === 0 && (
                <Typography>No hay medidores sin lectura activa.</Typography>
              )}
              {rows.map((row) => (
                <Stack
                  key={row.meterId}
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography>
                    {row.serialNumber} · <PropertyName id={row.propertyId} /> ·{' '}
                    {row.unit}
                  </Typography>
                  <Button
                    component={Link}
                    to={`/lecturas?by=meter&meterId=${row.meterId}&billingPeriodId=${periodId}&capture=1`}
                  >
                    Capturar lectura
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </QuerySection>
      )}
      <QuerySection title="Anomalías del período" query={abnormal}>
        {(rows) => (
          <Stack spacing={1}>
            <Typography variant="body2">
              Las anomalías se consultan para todo el período, sin filtro de
              propiedad.
            </Typography>
            {rows.length === 0 && (
              <Typography>No hay anomalías activas.</Typography>
            )}
            {rows.map((row) => (
              <Alert key={row.readingId} severity="warning">
                <MeterName id={row.meterId} />:{' '}
                {row.alerts.map((alert) => alert.message).join(' · ')}{' '}
                <Button component={Link} to={`/lecturas/${row.readingId}`}>
                  Abrir lectura e historial
                </Button>
              </Alert>
            ))}
          </Stack>
        )}
      </QuerySection>
    </Stack>
  )
}
