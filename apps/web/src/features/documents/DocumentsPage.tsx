import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
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
import { ApiError } from '../../shared/api/client'
import { extractionStatuses, listExtractions, uploadEvidence } from './api'
import type { ExtractionStatusValue } from './api'

const statusLabels: Record<ExtractionStatusValue, string> = {
  Queued: 'En cola',
  Processing: 'Procesando',
  NeedsReview: 'Requiere revisión',
  Failed: 'Falló',
  Confirmed: 'Confirmado',
}

export function DocumentsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [localError, setLocalError] = useState<unknown>(null)
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const rawStatus = params.get('status') ?? ''
  const status = extractionStatuses.includes(rawStatus as ExtractionStatusValue)
    ? (rawStatus as ExtractionStatusValue)
    : undefined
  const query = useQuery({
    queryKey: ['extractions', 'list', { page, status }],
    queryFn: ({ signal }) =>
      listExtractions({ page, pageSize: 25, status }, signal),
  })
  const upload = useMutation({
    mutationFn: uploadEvidence,
    onSuccess: async (response) => {
      await client.invalidateQueries({ queryKey: ['extractions'] })
      const period = params.get('billingPeriodId')
      navigate(
        `/documentos/${response.data.extractionId}${period ? `?billingPeriodId=${encodeURIComponent(period)}` : ''}`,
      )
    },
    retry: false,
  })
  const chooseFile = (file?: File) => {
    if (!file) return
    setLocalError(null)
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setLocalError(
        new Error(
          'El archivo debe ser JPEG, PNG o PDF con tipo MIME reconocido.',
        ),
      )
      return
    }
    if (file.size === 0 || file.size > 20 * 1024 * 1024) {
      setLocalError(
        new Error('El archivo debe tener contenido y no superar 20 MiB.'),
      )
      return
    }
    upload.mutate(file)
  }
  const changeStatus = (value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      if (value) next.set('status', value)
      else next.delete('status')
      next.delete('page')
      return next
    })
  return (
    <>
      <PageHeading
        eyebrow="DOCUMENTOS / EXTRACCIÓN"
        title="Documentos y OCR"
        description="Recupera trabajos de extracción, revisa sus propuestas y confirma lecturas manualmente."
        action={
          <Button
            component="label"
            variant="contained"
            startIcon={<AddRounded />}
            disabled={upload.isPending}
          >
            {upload.isPending ? 'Subiendo original…' : 'Subir documento'}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(event) => {
                chooseFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            mb: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <TextField
            select
            label="Estado de extracción"
            size="small"
            value={status ?? ''}
            onChange={(event) => changeStatus(event.target.value)}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">Todos los estados</MenuItem>
            {extractionStatuses.map((item) => (
              <MenuItem key={item} value={item}>
                {statusLabels[item]}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            JPEG, PNG o PDF · máximo 20 MiB
          </Typography>
        </Stack>
        {Boolean(localError) && <ProblemAlert error={localError} />}
        {upload.error && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            <ProblemAlert error={upload.error} />
            {upload.error instanceof ApiError && upload.error.status === 0 && (
              <Typography variant="body2" color="warning.main">
                La carga no ofrece reintento idempotente. Revisa la bandeja
                antes de subir el mismo original otra vez.
              </Typography>
            )}
          </Stack>
        )}
        {query.isError ? (
          <Stack spacing={2}>
            <ProblemAlert error={query.error} />
            <Button
              onClick={() => void query.refetch()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Reintentar
            </Button>
          </Stack>
        ) : query.isPending ? (
          <Box role="status" aria-label="Cargando documentos">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} height={58} />
            ))}
          </Box>
        ) : query.data.items.length === 0 ? (
          <Typography role="status" color="text.secondary" sx={{ py: 5 }}>
            {status
              ? `No hay trabajos con estado ${statusLabels[status].toLowerCase()}.`
              : 'Aún no hay documentos cargados.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table aria-label="Trabajos de extracción OCR">
              <TableHead>
                <TableRow>
                  <TableCell>Archivo</TableCell>
                  <TableCell>Extracción</TableCell>
                  <TableCell>Intentos</TableCell>
                  <TableCell>Disponible</TableCell>
                  <TableCell>Resultado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Button
                        component={Link}
                        to={`/documentos/${item.id}`}
                        sx={{ textTransform: 'none' }}
                      >
                        {item.fileName}
                      </Button>
                    </TableCell>
                    <TableCell>{statusLabels[item.status]}</TableCell>
                    <TableCell>{item.attempts}</TableCell>
                    <TableCell>
                      {new Date(item.availableAt).toLocaleString('es-CL', {
                        timeZone: 'America/Santiago',
                      })}
                    </TableCell>
                    <TableCell>
                      {item.error ? (
                        <Typography color="error.main" variant="body2">
                          {item.error}
                        </Typography>
                      ) : item.confirmedReadingId ? (
                        <Button
                          component={Link}
                          to={`/lecturas/${item.confirmedReadingId}`}
                        >
                          Abrir lectura confirmada
                        </Button>
                      ) : (
                        'Sin lectura resultante'
                      )}
                    </TableCell>
                  </TableRow>
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
              {query.data.totalCount} trabajos · página {query.data.pageNumber}
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
    </>
  )
}
