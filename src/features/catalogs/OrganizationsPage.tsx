import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { CatalogNavigation } from './CatalogNavigation'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import {
  createOrganization,
  listOrganizations,
  updateOrganization,
} from './api'
import type { Organization } from './api'

export function OrganizationsPage() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const [editing, setEditing] = useState<Organization | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<unknown>(null)
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const search = params.get('search') ?? ''
  const query = useQuery({
    queryKey: ['organizations', 'list', { page, search }],
    queryFn: ({ signal }) =>
      listOrganizations({ page, pageSize: 25, search }, signal),
  })
  const close = () => {
    setCreating(false)
    setEditing(null)
    setError(null)
  }
  const mutation = useMutation({
    mutationFn: () =>
      editing
        ? updateOrganization(editing.id, {
            name: name.trim(),
            contactEmail: email.trim() || null,
          })
        : createOrganization({
            name: name.trim(),
            contactEmail: email.trim() || null,
          }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['organizations'] })
      close()
    },
    onError: setError,
    retry: false,
  })
  const openNew = () => {
    setName('')
    setEmail('')
    setError(null)
    setCreating(true)
  }
  const openEdit = (item: Organization) => {
    setName(item.name)
    setEmail(item.contactEmail ?? '')
    setError(null)
    setEditing(item)
  }
  const updateSearch = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('search', value)
    else next.delete('search')
    next.delete('page')
    setParams(next)
  }
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / CATÁLOGOS"
        title="Organizaciones"
        description="Administra las organizaciones y su correo de contacto."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={openNew}
          >
            Nueva organización
          </Button>
        }
      />
      <CatalogNavigation />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          label="Buscar por nombre"
          size="small"
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          sx={{ mb: 2, width: { xs: '100%', sm: 360 } }}
        />
        {query.isError ? (
          <Stack spacing={2}>
            <ProblemAlert error={query.error} />
            <Button onClick={() => void query.refetch()}>Reintentar</Button>
          </Stack>
        ) : query.isPending ? (
          <Box role="status" aria-label="Cargando organizaciones">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} height={54} />
            ))}
          </Box>
        ) : query.data.items.length === 0 ? (
          <Typography role="status" color="text.secondary" sx={{ py: 4 }}>
            {search
              ? 'No hay organizaciones que coincidan con la búsqueda.'
              : 'Aún no hay organizaciones registradas.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table aria-label="Organizaciones registradas">
              <TableHead>
                <TableRow>
                  <TableCell>Organización</TableCell>
                  <TableCell>Correo de contacto</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Button
                        component={Link}
                        to={`/configuracion/organizaciones/${item.id}`}
                      >
                        {item.name}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {item.contactEmail ?? 'Sin correo de contacto'}
                    </TableCell>
                    <TableCell align="right">
                      <Button onClick={() => openEdit(item)}>Editar</Button>
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
              {query.data.totalCount} organizaciones
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
      <Dialog
        open={creating || !!editing}
        onClose={close}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing ? 'Editar organización' : 'Nueva organización'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            <TextField
              label="Nombre"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Correo de contacto (opcional)"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 250 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={mutation.isPending || !name.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Guardando…'
              : editing
                ? 'Guardar cambios'
                : 'Crear organización'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
