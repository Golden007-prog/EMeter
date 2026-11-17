import { useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useQuery } from '@tanstack/react-query'
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
import { QuerySection } from '../../shared/ui/QuerySection'
import { CatalogSelect } from '../catalogs/CatalogSelect'
import { PropertySelect } from '../catalogs/PropertySelect'
import { BillingPeriodSelect } from '../readings/ReadingSelectors'
import { readingSources } from '../readings/api'
import type { ReadingSource } from '../readings/api'
import { getReconciliation } from './api'
import { Amount, OperationalReports, SummaryPanel } from './ReportPanels'

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const periodId = params.get('billingPeriodId') ?? ''
  const condominiumId = params.get('condominiumId') ?? ''
  const propertyId = params.get('propertyId') ?? ''
  const rawSource = params.get('source')
  const source = readingSources.includes(rawSource as ReadingSource)
    ? (rawSource as ReadingSource)
    : 'Resident'
  const change = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  const reconciliation = useQuery({
    queryKey: ['reports', 'reconciliation', condominiumId, periodId, source],
    queryFn: ({ signal }) =>
      getReconciliation(condominiumId, periodId, source, signal),
    enabled: !!condominiumId && !!periodId,
  })
  return (
    <Stack spacing={2}>
      <PageHeading
        eyebrow="REPORTES"
        title="Reportes"
        description="Consulta consumos, diferencias y tareas pendientes con las reglas de cálculo del servidor."
      />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <BillingPeriodSelect
            value={periodId}
            optional
            onChange={(period) => change('billingPeriodId', period?.id ?? '')}
          />
          <PropertySelect
            optional
            value={propertyId}
            onChange={(property) => change('propertyId', property?.id ?? '')}
          />
          <Typography variant="body2">
            La propiedad filtra pendientes y faltantes. Sin período, pendientes
            y anomalías incluyen todos los períodos.
          </Typography>
        </Stack>
      </Paper>
      {periodId ? (
        <SummaryPanel periodId={periodId} />
      ) : (
        <Alert severity="info">
          Selecciona un período para ver resumen, faltantes y conciliación.
        </Alert>
      )}
      <OperationalReports
        periodId={periodId || undefined}
        propertyId={propertyId || undefined}
      />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            Conciliación de condominio
          </Typography>
          <CatalogSelect
            id="reconciliation-condominium"
            kind="condominiums"
            label="Condominio"
            value={condominiumId}
            onChange={(item) => change('condominiumId', item?.id ?? '')}
          />
          <TextField
            select
            label="Origen de conciliación"
            value={source}
            onChange={(event) => change('source', event.target.value)}
          >
            {readingSources.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>
      {periodId && condominiumId && (
        <QuerySection title="Resultado de conciliación" query={reconciliation}>
          {(data) => (
            <Stack spacing={1}>
              <Alert severity={data.isComplete ? 'success' : 'warning'}>
                {data.isComplete
                  ? 'Conciliación completa'
                  : 'Conciliación incompleta'}{' '}
                · {data.explanation}
              </Alert>
              <Typography>
                Unidad: {data.unit ?? 'No disponible'} · Origen: {data.source}
              </Typography>
              <Typography>
                Principal: <Amount value={data.mainConsumption} />
              </Typography>
              <Typography>
                Submedidores
                {data.isComplete
                  ? ''
                  : ' (subtotal posiblemente parcial)'}:{' '}
                <Amount value={data.subMeterConsumption} />
              </Typography>
              <Typography>
                Diferencia: <Amount value={data.difference} /> · Porcentaje:{' '}
                <Amount value={data.differencePercentage} />
                {data.differencePercentage == null ? '' : ' %'}
              </Typography>
              {data.suspects.map((item) => (
                <Alert key={item.propertyId} severity="warning">
                  {item.propertyName}: {item.reasons.join(' · ')} · Consumo:{' '}
                  <Amount value={item.consumption} />{' '}
                  <Button
                    component={Link}
                    to={`/lecturas?by=property&propertyId=${item.propertyId}&billingPeriodId=${periodId}`}
                  >
                    Consultar lecturas
                  </Button>
                </Alert>
              ))}
            </Stack>
          )}
        </QuerySection>
      )}
    </Stack>
  )
}
