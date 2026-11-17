import { useState } from 'react'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
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
import { QuerySection } from '../../shared/ui/QuerySection'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import {
  attachEvidence,
  listEvidenceForReading,
  listExtractions,
  uploadEvidence,
} from './api'
import { OriginalFile } from './OriginalFile'

export function ReadingEvidence({
  readingId,
  disabled,
}: {
  readingId: string
  disabled: boolean
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState('')
  const [uploaded, setUploaded] = useState<{
    id: string
    fileName: string
  } | null>(null)
  const [preview, setPreview] = useState<{
    id: string
    fileName: string
  } | null>(null)
  const evidence = useQuery({
    queryKey: ['evidence', 'reading', readingId],
    queryFn: ({ signal }) => listEvidenceForReading(readingId, signal),
  })
  const files = useQuery({
    queryKey: ['extractions', 'list', 'attach', page],
    queryFn: ({ signal }) => listExtractions({ page, pageSize: 25 }, signal),
    enabled: open,
  })
  const upload = useMutation({
    mutationFn: (file: File) => {
      if (
        !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
        file.size === 0 ||
        file.size > 20 * 1024 * 1024
      )
        throw new Error(
          'Selecciona JPEG, PNG o PDF con contenido y máximo 20 MiB.',
        )
      return uploadEvidence(file)
    },
    onSuccess: async (result) => {
      setUploaded(result.data)
      setSelected(result.data.id)
      await client.invalidateQueries({ queryKey: ['extractions'] })
    },
  })
  const attach = useMutation({
    mutationFn: () => attachEvidence(readingId, selected),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['evidence'] }),
        client.invalidateQueries({ queryKey: ['readings'] }),
      ])
      setOpen(false)
      setSelected('')
      setUploaded(null)
    },
  })
  const busy = upload.isPending || attach.isPending
  return (
    <>
      <QuerySection title="Evidencias asociadas" query={evidence}>
        {(rows) => (
          <Stack spacing={1}>
            {!rows.length && (
              <Typography>No hay documentos asociados.</Typography>
            )}
            {rows.map((item) => (
              <Button key={item.id} onClick={() => setPreview(item)}>
                {item.fileName} · Ver y descargar
              </Button>
            ))}
            <Button
              variant="outlined"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              Adjuntar evidencia
            </Button>
          </Stack>
        )}
      </QuerySection>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Adjuntar evidencia a esta lectura</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Adjuntar respalda esta lectura sin crear otra. La carga también
              genera un trabajo OCR independiente; confirmarlo crearía una nueva
              lectura.
            </Alert>
            <Button component="label" disabled={busy}>
              Subir nuevo original
              <input
                hidden
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file && !busy) upload.mutate(file)
                  event.target.value = ''
                }}
              />
            </Button>
            {uploaded && (
              <Typography>
                Original cargado: {uploaded.fileName}. Si falla la asociación,
                reintenta adjuntarlo sin volver a subirlo.
              </Typography>
            )}
            {upload.error && (
              <>
                <ProblemAlert error={upload.error} />
                <Typography>
                  Revisa la bandeja antes de repetir una carga cuya respuesta se
                  haya perdido.
                </Typography>
              </>
            )}
            {files.error && <ProblemAlert error={files.error} />}
            <TextField
              select
              label="Original disponible"
              value={selected}
              disabled={busy}
              onChange={(event) => setSelected(event.target.value)}
            >
              <MenuItem value="">Selecciona un original</MenuItem>
              {uploaded &&
                !files.data?.items.some(
                  (item) => item.evidenceId === uploaded.id,
                ) && (
                  <MenuItem value={uploaded.id}>{uploaded.fileName}</MenuItem>
                )}
              {files.data?.items.map((item) => (
                <MenuItem key={item.id} value={item.evidenceId}>
                  {item.fileName} · {item.status}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row">
              <Button
                disabled={page <= 1 || busy}
                onClick={() => {
                  setSelected('')
                  setPage(page - 1)
                }}
              >
                Anteriores
              </Button>
              <Button
                disabled={!files.data?.hasNextPage || busy}
                onClick={() => {
                  setSelected('')
                  setPage(page + 1)
                }}
              >
                Más originales
              </Button>
              <Button onClick={() => void files.refetch()}>Actualizar</Button>
            </Stack>
            <Button component={Link} to="/documentos">
              Consultar bandeja de documentos
            </Button>
            {attach.error && <ProblemAlert error={attach.error} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={busy || !selected || disabled}
            onClick={() => attach.mutate()}
          >
            Adjuntar original seleccionado
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Evidencia original</DialogTitle>
        <DialogContent>
          {preview && (
            <OriginalFile id={preview.id} fileName={preview.fileName} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
