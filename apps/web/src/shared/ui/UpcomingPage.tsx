import { Button, Paper, Typography } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { PageHeading } from './PageHeading'

export function UpcomingPage({
  title,
  description,
  detail,
}: {
  title: string
  description: string
  detail: string
}) {
  const location = useLocation()
  return (
    <>
      <PageHeading
        eyebrow="ESPACIO DE TRABAJO"
        title={title}
        description={description}
      />
      <Paper variant="outlined" className="empty-state">
        <Typography variant="overline" color="primary">
          Próxima entrega
        </Typography>
        <Typography variant="h6" component="h2" sx={{ mt: 1, mb: 1 }}>
          Estamos preparando este espacio
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520, mb: 3 }}>
          {detail}
        </Typography>
        <Button
          component={Link}
          to={`/configuracion/propiedades${location.search}`}
          variant="contained"
        >
          Configurar propiedades
        </Button>
      </Paper>
    </>
  )
}
