import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { QuerySection } from '../../shared/ui/QuerySection'
import { BillingPeriodSelect } from '../readings/ReadingSelectors'
import { getBillingPeriod, setBillingPeriodStatus } from '../catalogs/api'
import { listReadingsByPeriod } from '../readings/api'
import { useReadingMeterNames } from '../readings/catalogNames'
import { OperationalReports, SummaryPanel } from '../reports/ReportPanels'

export function PeriodWorkspacePage() {
  const [params, setParams] = useSearchParams()
  const periodId = params.get('billingPeriodId') ?? ''
  return (
    <Stack spacing={2}>
      <PageHeading
        eyebrow="ESPACIO DE TRABAJO"
        title="Resumen del período"
        description="Revisa faltantes, decisiones pendientes y consumos antes de cerrar."
      />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <BillingPeriodSelect
          value={periodId}
          onChange={(item) =>
            setParams((old) => {
              const next = new URLSearchParams(old)
              if (item) next.set('billingPeriodId', item.id)
              else next.delete('billingPeriodId')
              return next
            })
          }
        />
      </Paper>
      {periodId ? (
        <PeriodContent key={periodId} id={periodId} />
      ) : (
        <Alert severity="info">
          Selecciona un período o créalo en Configuración → Períodos.
        </Alert>
      )}
    </Stack>
  )
}

function PeriodContent({ id }: { id: string }) {
  const client = useQueryClient()
  const [closing, setClosing] = useState(false)
  const period = useQuery({
    queryKey: ['billing-periods', 'detail', id],
    queryFn: ({ signal }) => getBillingPeriod(id, signal),
  })
  const readings = useQuery({
    queryKey: ['readings', 'period', id],
    queryFn: ({ signal }) => listReadingsByPeriod(id, signal),
  })
  const confirmed =
    readings.data?.filter((row) => row.reviewStatus === 'Confirmed') ?? []
  const meterNames = useReadingMeterNames(confirmed)
  const close = useMutation({
    mutationFn: () => setBillingPeriodStatus(id, 'Closed'),
    onSuccess: async () => {
      await client.invalidateQueries()
      setClosing(false)
    },
    onError: async () => {
      await client.invalidateQueries({ queryKey: ['billing-periods'] })
    },
  })
  return (
    <Stack spacing={2}>
      <QuerySection title="Estado del período" query={period}>
        {(data) => (
          <Stack spacing={1}>
            <Typography>
              {new Date(data.start).toLocaleString('es-CL', {
                timeZone: 'America/Santiago',
              })}{' '}
              a{' '}
              {new Date(data.end).toLocaleString('es-CL', {
                timeZone: 'America/Santiago',
              })}{' '}
              · {data.status}
            </Typography>
            {data.status === 'Closed' ? (
              <Alert severity="warning">
                Período cerrado. Las lecturas y evidencias se conservan para
                consulta; no se puede reabrir.
              </Alert>
            ) : (
              <Button
                color="error"
                variant="outlined"
                onClick={() => {
                  void client.invalidateQueries({ queryKey: ['reports'] })
                  setClosing(true)
                }}
              >
                Cerrar período
              </Button>
            )}
            <Button
              component={Link}
              to={`/lecturas?by=period&billingPeriodId=${id}`}
            >
              Consultar lecturas del período
            </Button>
          </Stack>
        )}
      </QuerySection>
      <SummaryPanel periodId={id} />
      <OperationalReports periodId={id} />
      <QuerySection title="Lecturas confirmadas" query={readings}>
        {() => (
          <Stack>
            {confirmed.map((row) => (
              <Button key={row.id} component={Link} to={`/lecturas/${row.id}`}>
                {meterNames.get(row.meterId)} · {row.value.toString()}{' '}
                {row.unit} · {row.source}
                {row.status === 'Warning' ? ' · Con advertencias' : ''}
              </Button>
            ))}
            {!confirmed.length && (
              <Typography>No hay lecturas confirmadas.</Typography>
            )}
          </Stack>
        )}
      </QuerySection>
      <Dialog
        open={closing}
        onClose={() => {
          if (!close.isPending) setClosing(false)
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Cerrar período definitivamente</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              No podrás reabrir este período, agregar lecturas o evidencias ni
              corregir sus datos. El cierre puede conservar pendientes o
              advertencias: revisa el resumen antes de continuar.
            </Alert>
            <SummaryPanel periodId={id} />
            {close.error && <ProblemAlert error={close.error} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={close.isPending} onClick={() => setClosing(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={close.isPending || period.data?.status === 'Closed'}
            onClick={() => close.mutate()}
          >
            Confirmar cierre irreversible
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
