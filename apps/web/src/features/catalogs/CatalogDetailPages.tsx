import { useParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useQuery } from '@tanstack/react-query'
import { Button, Stack, Typography } from '@mui/material'
import { PageHeading } from '../../shared/ui/PageHeading'
import { QuerySection } from '../../shared/ui/QuerySection'
import { CatalogNavigation } from './CatalogNavigation'
import { getMeter, getOption, resourceLabels } from './api'
import { PropertyName } from '../reports/ReportPanels'

export function OrganizationDetailPage() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['organizations', 'detail', id],
    queryFn: ({ signal }) => getOption('organizations', id, signal),
  })
  return (
    <Stack spacing={2}>
      <PageHeading
        eyebrow="CONFIGURACIÓN"
        title="Detalle de organización"
        description="Contacto y entidades asociadas."
      />
      <CatalogNavigation />
      <QuerySection title="Organización" query={query}>
        {(data) => (
          <Stack spacing={1}>
            <Typography>{data.name}</Typography>
            <Typography>
              {'contactEmail' in data
                ? (data.contactEmail ?? 'Sin contacto')
                : ''}
            </Typography>
            <Button
              component={Link}
              to={`/configuracion/organizaciones?search=${encodeURIComponent(data.name)}`}
            >
              Editar en directorio
            </Button>
            <Button
              component={Link}
              to={`/configuracion/condominios?organizationId=${id}`}
            >
              Consultar condominios
            </Button>
            <Button
              component={Link}
              to={`/configuracion/propiedades?organizationId=${id}`}
            >
              Consultar propiedades
            </Button>
          </Stack>
        )}
      </QuerySection>
    </Stack>
  )
}
export function MeterDetailPage() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['meters', 'detail', id],
    queryFn: ({ signal }) => getMeter(id, signal),
  })
  return (
    <Stack spacing={2}>
      <PageHeading
        eyebrow="CONFIGURACIÓN"
        title="Detalle de medidor"
        description="Equipo, propiedad e historial de medición."
      />
      <CatalogNavigation />
      <QuerySection title="Medidor" query={query}>
        {(data) => (
          <Stack spacing={1}>
            <Typography>Serie: {data.serialNumber}</Typography>
            <Typography>
              Propiedad: <PropertyName id={data.propertyId} />
            </Typography>
            <Typography>
              {resourceLabels[data.resourceType]} · {data.unit} · Modelo:{' '}
              {data.model || 'Sin modelo'}
            </Typography>
            <Typography>
              Instalación:{' '}
              {new Date(data.installedAt).toLocaleString('es-CL', {
                timeZone: 'America/Santiago',
              })}
            </Typography>
            <Button component={Link} to={`/lecturas?by=meter&meterId=${id}`}>
              Consultar historial de lecturas
            </Button>
            <Button
              component={Link}
              to={`/configuracion/medidores?search=${encodeURIComponent(data.serialNumber)}`}
            >
              Editar en directorio
            </Button>
            <Button
              component={Link}
              to={`/configuracion/propiedades/${data.propertyId}`}
            >
              Abrir propiedad
            </Button>
          </Stack>
        )}
      </QuerySection>
    </Stack>
  )
}
