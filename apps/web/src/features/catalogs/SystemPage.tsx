import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button, Stack, Typography } from '@mui/material'
import { apiRequest } from '../../shared/api/client'
import { PageHeading } from '../../shared/ui/PageHeading'
import { QuerySection } from '../../shared/ui/QuerySection'
import { CatalogNavigation } from './CatalogNavigation'

const versionSchema = z.object({
  fileVersion: z.string(),
  informationalVersion: z.string(),
})
export function SystemPage() {
  const query = useQuery({
    queryKey: ['system', 'version'],
    queryFn: async ({ signal }) =>
      versionSchema.parse(await apiRequest('/api/version', { signal })),
  })
  return (
    <Stack spacing={2}>
      <PageHeading
        eyebrow="CONFIGURACIÓN"
        title="Sistema"
        description="Información de la API conectada."
      />
      <CatalogNavigation />
      <QuerySection title="Versión de la API" query={query}>
        {(data) => (
          <Stack spacing={1}>
            <Typography>Versión: {data.fileVersion}</Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              Compilación: {data.informationalVersion}
            </Typography>
            <Typography>
              Conexión con la API disponible. El procesamiento documental se
              consulta en Documentos y OCR.
            </Typography>
            <Button onClick={() => void query.refetch()}>
              Actualizar versión
            </Button>
          </Stack>
        )}
      </QuerySection>
    </Stack>
  )
}
