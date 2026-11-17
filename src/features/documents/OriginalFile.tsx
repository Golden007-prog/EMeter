import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { Button, Stack, Typography } from '@mui/material'
import { QuerySection } from '../../shared/ui/QuerySection'
import { downloadEvidence } from './api'

export function OriginalFile({
  id,
  fileName,
}: {
  id: string
  fileName?: string
}) {
  const query = useQuery({
    queryKey: ['evidence', 'original', id],
    queryFn: () => downloadEvidence(id),
    gcTime: 0,
  })
  return (
    <QuerySection title="Documento original" query={query}>
      {(data) => {
        const name = fileName ?? data.fileName
        const previewable =
          ['application/pdf', 'image/png', 'image/jpeg'].includes(
            data.contentType.split(';')[0],
          ) &&
          (data.contentType.split(';')[0] !== 'application/pdf' ||
            navigator.pdfViewerEnabled)
        return (
          <Stack spacing={1}>
            <Typography>{name}</Typography>
            <Button
              onClick={() => {
                const url = URL.createObjectURL(data.blob)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = name
                anchor.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
            >
              Descargar original
            </Button>
            {previewable && <FilePreview blob={data.blob} />}
            <Typography variant="caption">
              Si el navegador no muestra el original, descárgalo para revisarlo.
            </Typography>
          </Stack>
        )
      }}
    </QuerySection>
  )
}

function FilePreview({ blob }: { blob: Blob }) {
  const attach = useCallback(
    (node: HTMLIFrameElement | null) => {
      if (!node) return
      const url = URL.createObjectURL(blob)
      node.src = url
      return () => URL.revokeObjectURL(url)
    },
    [blob],
  )
  return (
    <iframe
      title="Vista del documento original"
      style={{ width: '100%', height: 480, border: 0 }}
      ref={attach}
    />
  )
}
