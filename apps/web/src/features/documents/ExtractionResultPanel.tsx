import {
  Alert,
  Box,
  Divider,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import type { ExtractedBill } from './api'

const labels: Record<string, string> = {
  provider: 'Proveedor',
  customerNumber: 'Número de cliente',
  documentNumber: 'Número de documento',
  previousReading: 'Lectura anterior',
  currentReading: 'Lectura actual',
  consumption: 'Consumo facturado',
  totalAmount: 'Total a pagar',
  previousDebt: 'Deuda anterior',
  dueDate: 'Vencimiento',
  issueDate: 'Emisión',
  period: 'Período',
  unit: 'Unidad',
  currency: 'Moneda',
  serviceAddress: 'Dirección de suministro',
  tariffSector: 'Sector tarifario',
  connectedPower: 'Potencia conectada',
  connectedPowerUnit: 'Unidad de potencia',
  contractedTariff: 'Tarifa contratada',
  route: 'Ruta',
  meterNumber: 'Número de medidor',
  meterOwnership: 'Propiedad del medidor',
  meterConstant: 'Constante del medidor',
  nextEstimatedReadingDate: 'Próxima lectura estimada',
  cutoffDate: 'Fecha de corte',
  lastPaymentDate: 'Fecha del último pago',
  lastPaymentAmount: 'Monto del último pago',
  lastPaymentCurrency: 'Moneda del último pago',
  sameMonthLastYearVariationPercent: 'Variación interanual (%)',
  previousMonthVariationPercent: 'Variación mensual (%)',
}

function fieldLabel(key: string) {
  return (
    labels[key] ??
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (character) => character.toUpperCase())
  )
}

function KeyValueGrid({ values }: { values: Record<string, string> }) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(10rem, 0.7fr) 1fr' },
        gap: 0.75,
        m: 0,
      }}
    >
      {Object.entries(values).map(([key, value]) => (
        <Box key={key} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {fieldLabel(key)}
          </Typography>
          <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1}>
      <Divider />
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Stack>
  )
}

export function ExtractionResultPanel({ result }: { result: ExtractedBill }) {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography>
          Motor: {result.engine} · Confianza de reconocimiento:{' '}
          {result.confidence?.toString() ?? 'No disponible'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Contrato OCR v{result.schemaVersion}. La confianza no garantiza que un
          campo sea correcto; consumo y monto no son lecturas acumuladas.
        </Typography>
      </Stack>

      {result.warnings.map((warning, index) => (
        <Alert
          severity="warning"
          key={`${warning.code}-${warning.field}-${index}`}
        >
          {warning.message}
          {warning.field ? ` Campo: ${fieldLabel(warning.field)}.` : ''}
        </Alert>
      ))}

      {result.document && (
        <Section title="Documento">
          <KeyValueGrid
            values={{
              tipo: result.document.type,
              proveedor: result.document.provider ?? 'No identificado',
              páginas: String(result.document.pageCount),
              ...(result.document.documentNumber
                ? { documentNumber: result.document.documentNumber }
                : {}),
            }}
          />
        </Section>
      )}

      <Section title="Campos propuestos">
        {Object.keys(result.fields).length ? (
          <KeyValueGrid values={result.fields} />
        ) : (
          <Typography color="text.secondary">
            No hay campos sin conflicto.
          </Typography>
        )}
      </Section>

      {Object.keys(result.metadata).length > 0 && (
        <Section title="Metadata de la boleta">
          <KeyValueGrid values={result.metadata} />
        </Section>
      )}

      {result.readings.length > 0 && (
        <Section title="Lecturas encontradas">
          {result.readings.map((reading, index) => (
            <Box
              key={`${reading.meterNumber}-${index}`}
              sx={{ pl: 1, borderLeft: 3, borderColor: 'divider' }}
            >
              <KeyValueGrid
                values={Object.fromEntries(
                  Object.entries({
                    meterNumber: reading.meterNumber,
                    meterOwnership: reading.ownership,
                    currentReading: reading.currentValue,
                    previousReading: reading.previousValue,
                    consumption: reading.consumption,
                    unit: reading.unit,
                    meterConstant: reading.constant,
                    period: reading.period,
                    página: reading.page?.toString() ?? null,
                  }).filter(
                    (entry): entry is [string, string] => entry[1] !== null,
                  ),
                )}
              />
            </Box>
          ))}
        </Section>
      )}

      {result.charges.length > 0 && (
        <Section title="Detalle de cargos">
          <TableContainer>
            <Table size="small" aria-label="Detalle de cargos extraídos">
              <TableHead>
                <TableRow>
                  <TableCell>Concepto</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell align="right">Página</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.charges.map((charge, index) => (
                  <TableRow
                    key={`${charge.category}-${charge.description}-${index}`}
                  >
                    <TableCell>{charge.description}</TableCell>
                    <TableCell align="right">
                      {charge.amount} {charge.currency}
                    </TableCell>
                    <TableCell align="right">{charge.page ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      )}

      {result.artifacts.length > 0 && (
        <Section title="Códigos y elementos visuales">
          <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
            {result.artifacts.map((artifact, index) => {
              const isLink =
                artifact.value?.startsWith('https://') ||
                artifact.value?.startsWith('http://')
              return (
                <Typography
                  component="li"
                  key={`${artifact.type}-${artifact.value}-${index}`}
                >
                  <strong>{artifact.title ?? fieldLabel(artifact.type)}</strong>
                  {` · ${artifact.format ?? 'formato desconocido'} · página ${artifact.page} · ${artifact.status}`}
                  {artifact.value && (
                    <>
                      {' · '}
                      {isLink ? (
                        <Link
                          href={artifact.value}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {artifact.value}
                        </Link>
                      ) : (
                        <span>{artifact.value}</span>
                      )}
                    </>
                  )}
                </Typography>
              )
            })}
          </Stack>
        </Section>
      )}

      {Object.keys(result.proposals).length > 0 && (
        <details>
          <summary>Candidatos y procedencia</summary>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {Object.entries(result.proposals).map(([field, proposals]) => (
              <Box key={field}>
                <Typography sx={{ fontWeight: 700 }}>
                  {fieldLabel(field)}
                </Typography>
                {proposals.map((proposal, index) => (
                  <Typography
                    variant="body2"
                    key={`${proposal.source}-${proposal.page}-${index}`}
                  >
                    {proposal.value} · original: {proposal.rawValue} ·{' '}
                    {proposal.source}
                    {proposal.page ? ` · página ${proposal.page}` : ''}
                    {proposal.unit ? ` · ${proposal.unit}` : ''}
                  </Typography>
                ))}
              </Box>
            ))}
          </Stack>
        </details>
      )}

      <details>
        <summary>Texto reconocido</summary>
        <Typography
          component="pre"
          sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {result.text}
        </Typography>
      </details>
    </Stack>
  )
}
